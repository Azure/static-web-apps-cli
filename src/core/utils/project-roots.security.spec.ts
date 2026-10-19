import "../../../tests/_mocks/fs.js";
import { posix as simulated } from "../../../tests/_mocks/posix.js";
import { fs, vol } from "memfs";
import os from "node:os";
import * as nodeFs from "node:fs";
import { ExecutableResolutionOptions, resolveManagedExecutable, resolveTrustedExecutable, resolveTrustedPackageManager } from "./executable.js";

describe("invocation directory versus selected project trust (inert fixtures)", () => {
  const home = "/home/tester";
  const project = `${home}/project`;

  beforeEach(() => {
    vi.resetModules();
    vol.reset();
    vi.spyOn(os, "platform").mockReturnValue("linux");
    simulated.cwd = home;
    vol.fromJSON({ [`${project}/swa-cli.config.json`]: "{}" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function selectProject(invocation = home, selected = project) {
    simulated.cwd = invocation;
    // The module captures the original invocation cwd, before config loading/chdir.
    const { getProjectRoots } = await import("./cli-config.js");
    simulated.cwd = selected;
    return { untrustedRoots: getProjectRoots({ config: `${selected}/swa-cli.config.json`, appLocation: selected }) };
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
    // Act / Assert: HOME is an exact search-directory exclusion, not a recursive project root.
    expect(resolveManagedExecutable(tool, options)).toBe(tool);
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
    vi.stubEnv("PATH", `${runtime}/bin`);
    const options = await selectProject();
    // Act / Assert
    expect(resolveTrustedPackageManager("npm", options)).toEqual({ executable: script, args: [], resolutionOptions: options });
  });

  it("allows an ordinary HOME tool outside the project without cache-specific exemptions", async () => {
    // Arrange: the distinction is root classification, not a .swa/.nvm allowlist.
    const tool = `${home}/global-tools/func`;
    vol.fromJSON({ [tool]: "inert native fixture" });
    fs.chmodSync(tool, 0o755);
    vi.stubEnv("PATH", `${home}/global-tools`);
    const options = await selectProject();
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

  it("honors configured repository tools while retaining the recursive managed boundary", async () => {
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
    expect(() => resolveManagedExecutable(`${repo}/tools/func`, options)).toThrow(/inside the project/);
  });

  it("retains managed repository scope beneath a valid worktree .git file without banning configured tools", async () => {
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
    expect(() => resolveManagedExecutable(`${repo}/tools/func`, options)).toThrow(/inside the project/);
  });

  it.each(["package.json", "swa-cli.config.json"])(
    "retains managed non-Git project scope beneath %s without banning configured tools",
    async (marker) => {
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
      expect(() => resolveManagedExecutable(`${root}/tools/func`, options)).toThrow(/inside the project/);
    },
  );

  it("honors a selected-project PATH alias while rejecting that alias as a managed cache", async () => {
    // Arrange: invocation HOME has only exact scope, but selected project remains recursive.
    vol.fromJSON({ [`${project}/tools/func`]: "inert fixture" });
    fs.chmodSync(`${project}/tools/func`, 0o755);
    fs.symlinkSync(`${project}/tools`, "/selected-tools-alias");
    vi.stubEnv("PATH", "/selected-tools-alias");
    const options = await selectProject();
    // Act / Assert
    expectConfiguredTool(`${project}/tools/func`, options);
    expect(() => resolveManagedExecutable("/selected-tools-alias/func", options)).toThrow(/inside the project/);
  });

  it("retains canonical managed ancestry for an aliased project without banning configured repository tools", async () => {
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
    expect(() => resolveManagedExecutable(`${repo}/tools/func`, options)).toThrow(/inside the project/);
  });

  it.each([".git", "package.json"])("fails closed when invocation %s evidence cannot be inspected", async (marker) => {
    // Arrange: intercept the named fs API used by marker discovery, not a real filesystem permission.
    const denied = Object.assign(new Error("marker permission denied"), { code: "EACCES" });
    const stat = nodeFs.statSync;
    vi.spyOn(nodeFs, "statSync").mockImplementation((file, ...args) => {
      if (String(file) === `${home}/${marker}`) throw denied;
      return stat(file, ...args);
    });
    // Act / Assert
    await expect(selectProject()).rejects.toBe(denied);
  });
});
