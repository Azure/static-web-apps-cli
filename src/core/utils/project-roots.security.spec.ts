import "../../../tests/_mocks/fs.js";
import { fs, vol } from "memfs";
import os from "node:os";
import process from "node:process";
import * as nodeFs from "node:fs";
import { resolveManagedExecutable, resolveTrustedExecutable, resolveTrustedPackageManager } from "./executable.js";

const simulated = vi.hoisted(() => ({ cwd: "/home/tester" }));
vi.mock("node:process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:process") & { default: typeof process }>();
  const cwd = () => simulated.cwd;
  // Named and default imports must observe the same chdir in this isolated worker.
  return { ...actual, cwd, default: { ...actual.default, cwd } };
});

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

  it("allows the standard HOME managed Functions path outside the configured project", async () => {
    // Arrange
    const tool = `${home}/.swa/core-tools/v4/func`;
    vol.fromJSON({ [tool]: "inert native fixture" });
    const options = await selectProject();
    // Act / Assert: HOME is an exact search-directory exclusion, not a recursive project root.
    expect(resolveManagedExecutable(tool, options)).toBe(tool);
  });

  it("binds HOME runtime npm outside the configured project to current Node", async () => {
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
    expect(resolveTrustedPackageManager("npm", options)).toEqual({ executable: process.execPath, args: [script] });
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

  it("excludes a tool directly in the original invocation directory after chdir", async () => {
    // Arrange
    vol.fromJSON({ [`${home}/func`]: "inert fixture" });
    fs.chmodSync(`${home}/func`, 0o755);
    vi.stubEnv("PATH", home);
    const options = await selectProject();
    // Act / Assert
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
  });

  it("excludes a canonical alias of the original invocation search directory", async () => {
    // Arrange
    vol.fromJSON({ [`${home}/func`]: "inert fixture" });
    fs.chmodSync(`${home}/func`, 0o755);
    fs.symlinkSync(home, "/invocation-alias");
    vi.stubEnv("PATH", "/invocation-alias");
    const options = await selectProject();
    // Act / Assert
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
  });

  it("retains recursive exclusion when invocation is a real repository root", async () => {
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
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
  });

  it("retains recursive repository scope for nested invocation under a valid worktree .git file", async () => {
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
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
  });

  it.each(["package.json", "swa-cli.config.json"])("retains recursive non-Git project scope for nested invocation beneath %s", async (marker) => {
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
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
  });

  it("rejects actual selected-project descendants reached through an outside alias", async () => {
    // Arrange: invocation HOME has only exact scope, but selected project remains recursive.
    vol.fromJSON({ [`${project}/tools/func`]: "inert fixture" });
    fs.chmodSync(`${project}/tools/func`, 0o755);
    fs.symlinkSync(`${project}/tools`, "/selected-tools-alias");
    vi.stubEnv("PATH", "/selected-tools-alias");
    const options = await selectProject();
    // Act / Assert
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
  });

  it("retains canonical repository ancestry when the selected project is a directory alias", async () => {
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
    expect(resolveTrustedExecutable("func", options)).toBeUndefined();
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
