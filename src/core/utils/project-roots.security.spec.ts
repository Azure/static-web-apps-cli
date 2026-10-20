import "../../../tests/_mocks/fs.js";
import { posix as simulated } from "../../../tests/_mocks/posix.js";
import { fs, vol } from "memfs";
import os from "node:os";
import * as nodeFs from "node:fs";
import { ExecutableResolutionOptions, resolveTrustedExecutable, resolveTrustedExecutablePath, resolveTrustedPackageManager } from "./executable.js";

describe("configured tools at invocation versus operation cwd (inert fixtures)", () => {
  const home = "/home/tester";
  const project = `${home}/project`;

  beforeEach(() => {
    vi.resetModules();
    vol.reset();
    vi.spyOn(os, "platform").mockReturnValue("linux");
    simulated.cwd = home;
    vol.fromJSON({ [`${project}/swa-cli.config.json`]: "{}", [`${project}/func`]: "off-PATH CWD canary" });
    fs.chmodSync(`${project}/func`, 0o755);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function selectProject(invocation = home, selected = project): ExecutableResolutionOptions {
    simulated.cwd = invocation;
    return { cwd: selected };
  }

  function expectConfiguredTool(tool: string, options: ExecutableResolutionOptions) {
    expect(resolveTrustedExecutable("func", options)).toBe(tool);
    vi.stubEnv("PATH", "/off-path");
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
  }

  it("allows the standard HOME managed Functions path outside the configured project", async () => {
    // Arrange
    const tool = `${home}/.swa/core-tools/v4/func`;
    vol.fromJSON({ [tool]: "inert native fixture" });
    const options = await selectProject();
    fs.chmodSync(tool, 0o755);
    vi.stubEnv("PATH", `${home}/.swa/core-tools/v4`);
    // Existing managed identities are canonical; unrelated project ancestry is not policy.
    expect(resolveTrustedExecutablePath(tool)).toBe(tool);
    expectConfiguredTool(tool, options);
  });

  it("preserves the canonical HOME runtime npm launcher outside the configured project", async () => {
    // Arrange
    const runtime = `${home}/.nvm/versions/node/v20.18.0`;
    const script = `${runtime}/lib/node_modules/npm/bin/npm-cli.js`;
    vol.fromJSON({
      [`${runtime}/lib/node_modules/npm/package.json`]: JSON.stringify({ name: "npm", bin: { npm: "bin/npm-cli.js" } }),
      [script]: "inert JS fixture",
    });
    fs.mkdirSync(`${runtime}/bin`, { recursive: true });
    fs.symlinkSync(script, `${runtime}/bin/npm`);
    fs.chmodSync(script, 0o755);
    vi.stubEnv("PATH", `${runtime}/bin`);
    const options = await selectProject();
    // Act / Assert
    expect(resolveTrustedPackageManager("npm", options)).toEqual({ executable: script, args: [], cwd: project });
    vi.stubEnv("PATH", "/off-path");
    expect(resolveTrustedExecutable("npm", options)).toBeUndefined();
  });

  it("allows a future configured HOME tool after creation without cache-specific exemptions", async () => {
    // Arrange: no .swa/.nvm allowlist or recursive HOME exclusion is needed.
    const tool = `${home}/global-tools/func`;
    vi.stubEnv("PATH", `${home}/global-tools`);
    const options = await selectProject();
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
    vol.fromJSON({ [tool]: "inert native fixture" });
    fs.chmodSync(tool, 0o755);
    vi.stubEnv("PATH", `${home}/global-tools`);
    // Act / Assert
    expect(resolveTrustedExecutable("func", options)).toBe(tool);
  });

  it("honors an explicit original invocation PATH entry after chdir but not an off-PATH shadow", async () => {
    // Arrange
    vol.fromJSON({ [`${home}/func`]: "inert fixture" });
    fs.chmodSync(`${home}/func`, 0o755);
    vi.stubEnv("PATH", home);
    const options = await selectProject();
    // Act / Assert
    expectConfiguredTool(`${home}/func`, options);
  });

  it("keeps an explicit invocation PATH alias canonical and ignores it when off PATH", async () => {
    // Arrange
    vol.fromJSON({ [`${home}/func`]: "inert fixture" });
    fs.chmodSync(`${home}/func`, 0o755);
    fs.symlinkSync(home, "/invocation-alias");
    vi.stubEnv("PATH", "/invocation-alias");
    const options = await selectProject();
    // Act / Assert
    expectConfiguredTool(`${home}/func`, options);
  });

  it("honors configured repository tools independently of Git marker ancestry", async () => {
    // Arrange: repository evidence, not merely an arbitrary HOME ancestor.
    const repo = "/repository";
    const selected = `${repo}/app`;
    vol.fromJSON({
      [`${repo}/.git/HEAD`]: "ref: refs/heads/main",
      [`${selected}/swa-cli.config.json`]: "{}",
      [`${repo}/tools/func`]: "inert fixture",
    });
    fs.chmodSync(`${repo}/tools/func`, 0o755);
    vi.stubEnv("PATH", `${repo}/tools`);
    const options = await selectProject(repo, selected);
    // Act / Assert
    expectConfiguredTool(`${repo}/tools/func`, options);
    expect(resolveTrustedExecutablePath(`${repo}/tools/func`)).toBe(`${repo}/tools/func`);
  });

  it("honors configured tools beneath a worktree .git file without marker discovery", async () => {
    // Arrange: the selected app is elsewhere; invocation repository evidence must not be erased.
    const repo = "/worktree";
    vol.fromJSON({
      [`${repo}/.git`]: "gitdir: /git-metadata/worktrees/local\n",
      "/git-metadata/worktrees/local/HEAD": "ref: refs/heads/main",
      [`${repo}/nested/.keep`]: "",
      [`${repo}/tools/func`]: "inert fixture",
    });
    fs.chmodSync(`${repo}/tools/func`, 0o755);
    vi.stubEnv("PATH", `${repo}/tools`);
    const options = await selectProject(`${repo}/nested`);
    // Act / Assert
    expectConfiguredTool(`${repo}/tools/func`, options);
    expect(resolveTrustedExecutablePath(`${repo}/tools/func`)).toBe(`${repo}/tools/func`);
  });

  it.each(["package.json", "swa-cli.config.json"])("honors configured tools beneath %s without a new project trust policy", async (marker) => {
    // Arrange
    const root = "/non-git-project";
    vol.fromJSON({
      [`${root}/${marker}`]: "{}",
      [`${root}/nested/.keep`]: "",
      [`${root}/tools/func`]: "inert fixture",
    });
    fs.chmodSync(`${root}/tools/func`, 0o755);
    vi.stubEnv("PATH", `${root}/tools`);
    const options = await selectProject(`${root}/nested`);
    // Act / Assert
    expectConfiguredTool(`${root}/tools/func`, options);
    expect(resolveTrustedExecutablePath(`${root}/tools/func`)).toBe(`${root}/tools/func`);
  });

  it("honors a selected-project PATH alias and canonical existing cache identity", async () => {
    // Explicit project choices remain configured choices, not implicit CWD preemption.
    vol.fromJSON({ [`${project}/tools/func`]: "inert fixture" });
    fs.chmodSync(`${project}/tools/func`, 0o755);
    fs.symlinkSync(`${project}/tools`, "/selected-tools-alias");
    vi.stubEnv("PATH", "/selected-tools-alias");
    const options = await selectProject();
    // Act / Assert
    expectConfiguredTool(`${project}/tools/func`, options);
    expect(resolveTrustedExecutablePath("/selected-tools-alias/func")).toBe(`${project}/tools/func`);
  });

  it("selects canonical configured tools when the operation cwd itself is aliased", async () => {
    // Arrange
    const repo = "/canonical-repo";
    vol.fromJSON({
      [`${repo}/.git/HEAD`]: "ref: refs/heads/main",
      [`${repo}/app/swa-cli.config.json`]: "{}",
      [`${repo}/tools/func`]: "inert fixture",
    });
    fs.chmodSync(`${repo}/tools/func`, 0o755);
    fs.symlinkSync(`${repo}/app`, "/selected-app-alias");
    vi.stubEnv("PATH", `${repo}/tools`);
    const options = await selectProject(home, "/selected-app-alias");
    // Act / Assert
    expectConfiguredTool(`${repo}/tools/func`, options);
    expect(resolveTrustedExecutablePath(`${repo}/tools/func`)).toBe(`${repo}/tools/func`);
  });

  it.each([".git", "package.json"])("does not inspect unrelated invocation %s markers during configured lookup", async (marker) => {
    // Unrelated marker permission must not become a tool-lookup policy.
    const denied = Object.assign(new Error("marker permission denied"), { code: "EACCES" });
    const stat = nodeFs.statSync;
    vi.spyOn(nodeFs, "statSync").mockImplementation((file, ...args) => {
      if (String(file) === `${home}/${marker}`) throw denied;
      return stat(file, ...args);
    });
    const tool = `${project}/tools/func`;
    vol.fromJSON({ [tool]: "inert executable" });
    fs.chmodSync(tool, 0o755);
    vi.stubEnv("PATH", "tools");
    // Relative PATH is interpreted at selected operation cwd, not invocation HOME.
    expectConfiguredTool(tool, await selectProject());
  });
});
