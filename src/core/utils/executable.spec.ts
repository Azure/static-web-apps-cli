import "../../../tests/_mocks/fs.js";
import { posix as simulated } from "../../../tests/_mocks/posix.js";
import { fs, vol } from "memfs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  assertAbsoluteExecutable,
  createShellExecutionSpec,
  prepareExecution,
  resolveTrustedExecutablePath,
  resolveTrustedExecutable,
  resolveTrustedPackageManager,
  ExecutableResolutionOptions,
  InternalExecutionSpec,
} from "./executable.js";
import * as nodeFs from "node:fs";
import * as fixtureOs from "node:os";
import * as fixturePath from "node:path";
import * as fixtureProcess from "node:process";
import * as fixtureUrl from "node:url";
import * as fixtureChildProcess from "node:child_process";

const nativeModules = {
  "node:fs": await vi.importActual<typeof import("node:fs") & { default: typeof import("node:fs") }>("node:fs"),
  "node:os": await vi.importActual<typeof import("node:os") & { default: typeof import("node:os") }>("node:os"),
  "node:path": await vi.importActual<typeof import("node:path") & { default: typeof import("node:path") }>("node:path"),
  "node:process": await vi.importActual<typeof import("node:process") & { default: typeof import("node:process") }>("node:process"),
  "node:url": await vi.importActual<typeof import("node:url")>("node:url"),
  "node:child_process": await vi.importActual<typeof import("node:child_process")>("node:child_process"),
};
const fixtureModules = {
  "node:fs": nodeFs,
  "node:os": fixtureOs,
  "node:path": fixturePath,
  "node:process": fixtureProcess,
  "node:url": fixtureUrl,
  "node:child_process": fixtureChildProcess,
};
const simulatedProcess = process;

describe("trusted executable boundary (inert files only)", () => {
  beforeEach(() => {
    vol.reset();
    vi.spyOn(os, "platform").mockReturnValue("linux");
    vi.spyOn(process, "cwd").mockReturnValue("/project");
    vol.fromJSON({
      "/project/func": "inert",
      "/project/tools/func": "inert",
      "/trusted/bin/func": "inert",
    });
    for (const file of Object.keys(vol.toJSON())) fs.chmodSync(file, 0o755);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("honors configured POSIX PATH order without adding off-PATH CWD", () => {
    // Arrange
    vi.stubEnv("PATH", ":.:tools:/project:/project/tools:/trusted/bin");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe("/project/func");
    vi.stubEnv("PATH", "/trusted/bin");
    expect(resolveTrustedExecutable("func")).toBe("/trusted/bin/func");
  });

  it("binds an explicit project PATH alias canonically but ignores it when off PATH", () => {
    // Arrange
    fs.symlinkSync("/project/tools", "/alias");
    vi.stubEnv("PATH", "/alias");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe("/project/tools/func");
    vi.stubEnv("PATH", "/trusted/bin");
    expect(resolveTrustedExecutable("func")).toBe("/trusted/bin/func");
  });

  it("allows explicitly configured API PATH tools through their canonical alias", () => {
    // Arrange
    vol.fromJSON({ "/api-root/bin/func": "inert" });
    fs.chmodSync("/api-root/bin/func", 0o755);
    fs.symlinkSync("/api-root", "/api-alias");
    vi.stubEnv("PATH", "/api-root/bin");
    // Act / Assert
    const options = { cwd: "/api-alias" };
    expect(resolveTrustedExecutable("func", options)).toBe("/api-root/bin/func");
    expect(resolveTrustedExecutablePath("/api-alias/bin/func")).toBe("/api-root/bin/func");
    vi.stubEnv("PATH", "/trusted/bin");
    expect(resolveTrustedExecutable("func", options)).toBe("/trusted/bin/func");
  });

  it("does not confuse a project-prefix sibling with a descendant", () => {
    // Arrange
    vol.fromJSON({ "/project-tools/func": "inert" });
    fs.chmodSync("/project-tools/func", 0o755);
    vi.stubEnv("PATH", "/project-tools");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe("/project-tools/func");
  });

  it("does not select a missing tool beneath an explicitly configured project alias", () => {
    // Arrange
    fs.symlinkSync("/project", "/cache-alias");
    // Act / Assert
    vi.stubEnv("PATH", "/cache-alias/not-downloaded:/trusted/bin");
    expect(resolveTrustedExecutable("func")).toBe("/trusted/bin/func");
    expect(resolveTrustedExecutablePath("/cache-alias/not-downloaded/func")).toBeUndefined();
  });

  it("keeps a future configured directory eligible once its executable exists", () => {
    // Arrange
    fs.symlinkSync("/trusted", "/cache-alias");
    // Act / Assert
    vi.stubEnv("PATH", "/cache-alias/new/version");
    expect(resolveTrustedExecutable("func")).toBeUndefined();
    vol.fromJSON({ "/trusted/new/version/func": "inert" });
    fs.chmodSync("/trusted/new/version/func", 0o755);
    expect(resolveTrustedExecutable("func")).toBe("/trusted/new/version/func");
    vi.stubEnv("PATH", "/off-path");
    expect(resolveTrustedExecutable("func")).toBeUndefined();
  });

  it("skips inaccessible PATH candidates but does not trust them", () => {
    // Arrange
    vi.stubEnv("PATH", "/inaccessible:/trusted/bin");
    const realpath = fs.realpathSync.bind(fs);
    vi.spyOn(fs, "realpathSync").mockImplementation((file, ...args) => {
      if (String(file).startsWith("/inaccessible")) throw Object.assign(new Error("denied"), { code: "EACCES" });
      return realpath(file, ...args);
    });
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe("/trusted/bin/func");
  });

  it("does not inspect unrelated project roots when selecting an existing configured tool", () => {
    // Arrange
    vi.stubEnv("PATH", "/trusted/bin");
    const realpath = fs.realpathSync.bind(fs);
    vi.spyOn(fs, "realpathSync").mockImplementation((file, ...args) => {
      if (String(file) === "/denied-root") throw Object.assign(new Error("denied"), { code: "EACCES" });
      return realpath(file, ...args);
    });
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe("/trusted/bin/func");
    expect(fs.realpathSync).not.toHaveBeenCalledWith("/denied-root");
    vi.stubEnv("PATH", "/off-path");
    expect(resolveTrustedExecutable("func")).toBeUndefined();
  });

  it("preserves an explicitly selected wrapper's absolute project interpreter", () => {
    // Arrange
    vol.fromJSON({ "/trusted/bin/func": "#!/project/node\ninert", "/project/node": "inert native fixture" });
    fs.chmodSync("/trusted/bin/func", 0o755);
    fs.chmodSync("/project/node", 0o755);
    vi.stubEnv("PATH", "/trusted/bin");
    // Act / Assert
    const executable = resolveTrustedExecutable("func")!;
    expect(executable).toBe("/trusted/bin/func");
    expect(prepareExecution({ executable, args: ["start"] })).toMatchObject({
      executable: "/project/node",
      args: ["/trusted/bin/func", "start"],
    });
  });

  it.each(["func", "./func"])("refuses a relative identity: %s", (file) => {
    expect(() => assertAbsoluteExecutable(file)).toThrow();
  });

  it.each(["/trusted/tool.cmd", "/trusted/tool.bat", "/trusted/tool.ps1"])(
    "does not confuse an absolute launcher with a relative identity: %s",
    (file) => {
      expect(() => assertAbsoluteExecutable(file)).not.toThrow();
    },
  );

  it("refuses an absolute script when its interpreter cannot be bound", () => {
    vol.fromJSON({ "/trusted/bin/func": "#!/missing/interpreter\ninert" });
    expect(() => prepareExecution({ executable: "/trusted/bin/func", args: [] })).toThrow(/trusted script interpreter/);
    expect(() => prepareExecution({ executable: "/trusted/tool.ps1", args: [] })).toThrow(/determine the interpreter/);
  });

  it("preserves the fixed trusted shebang loader and flags without removing configured project PATH", () => {
    vol.fromJSON({
      "/trusted/bin/func": "#!/trusted/bin/node --loader-flag\ninert",
      "/trusted/bin/node": "inert native fixture",
    });
    fs.chmodSync("/trusted/bin/node", 0o755);
    vi.stubEnv("PATH", "/project:/trusted/bin");
    const execution = prepareExecution({ executable: "/trusted/bin/func", args: ["start"] });
    expect({ executable: execution.executable, args: execution.args, searchPath: execution.env?.PATH }).toEqual({
      executable: "/trusted/bin/node",
      args: ["--loader-flag", "/trusted/bin/func", "start"],
      searchPath: "/project:/trusted/bin",
    });
  });

  it("retains future configured aliases and global alternatives without adding off-PATH CWD", () => {
    vol.fromJSON({
      "/trusted/bin/func": "#!/trusted/bin/node\ninert",
      "/trusted/bin/node": "inert native fixture",
    });
    fs.chmodSync("/trusted/bin/node", 0o755);
    fs.symlinkSync("/project", "/outside-project-alias");
    vi.stubEnv("PATH", "/outside-project-alias/future:/trusted/future:/trusted/bin");
    const prepared = prepareExecution({ executable: "/trusted/bin/func", args: [], cwd: "/project" });
    fs.mkdirSync("/project/future");
    fs.mkdirSync("/trusted/future");
    vol.fromJSON({ "/project/future/node": "inert project canary", "/trusted/future/node": "inert external identity" });
    fs.chmodSync("/project/future/node", 0o755);
    fs.chmodSync("/trusted/future/node", 0o755);
    vi.stubEnv("PATH", prepared.env!.PATH!);
    expect(prepared.env!.PATH!.split(":")).toEqual(["/outside-project-alias/future", "/trusted/future", "/trusted/bin"]);
    expect(resolveTrustedExecutable("node")).toBe("/project/future/node");
    vi.stubEnv("PATH", "/trusted/future:/trusted/bin");
    expect(resolveTrustedExecutable("node")).toBe("/trusted/future/node");
  });

  it.each(["yarn", "pnpm"] as const)("selects the actual external %s wrapper instead of a neighboring Corepack entrypoint", (manager) => {
    // Arrange
    const script = `/trusted/bin/node_modules/corepack/dist/${manager}.js`;
    vol.fromJSON({
      "/trusted/bin/node_modules/corepack/package.json": JSON.stringify({ name: "corepack", bin: { [manager]: `./dist/${manager}.js` } }),
      [script]: "inert JS fixture",
      [`/trusted/bin/${manager}`]: "inert external launcher",
    });
    fs.chmodSync(`/trusted/bin/${manager}`, 0o755);
    vi.stubEnv("PATH", "/trusted/bin");
    // Act / Assert
    expect(resolveTrustedPackageManager(manager)).toEqual({ executable: `/trusted/bin/${manager}`, args: [] });
  });

  it("never substitutes metadata for the configured launcher and keeps explicit aliases canonical", () => {
    // Arrange
    vol.fromJSON({
      "/trusted/bin/node_modules/npm/package.json": JSON.stringify({ name: "npm", bin: { npm: "bin/npm-cli.js" } }),
      "/project/npm-cli.js": "inert JS fixture",
      "/trusted/bin/npm": "inert external launcher",
    });
    fs.chmodSync("/trusted/bin/npm", 0o755);
    fs.mkdirSync("/trusted/bin/node_modules/npm/bin");
    fs.symlinkSync("/project/npm-cli.js", "/trusted/bin/node_modules/npm/bin/npm-cli.js");
    vi.stubEnv("PATH", "/trusted/bin");
    // Act / Assert
    expect(resolveTrustedPackageManager("npm")).toEqual({ executable: "/trusted/bin/npm", args: [] });
    fs.unlinkSync("/trusted/bin/npm");
    fs.symlinkSync("/project/npm-cli.js", "/trusted/bin/npm");
    const aliased = resolveTrustedPackageManager("npm");
    expect(aliased.executable).toBe("/project/npm-cli.js");
    expect(() => prepareExecution(aliased)).toThrow(/determine the interpreter/);
  });
});

describe("simulated Windows known shim identities (not native proof)", () => {
  const fixtures = new Map<string, string>();
  const canonical = (file: string) => path.win32.normalize(file).toLowerCase();

  beforeEach(() => {
    fixtures.clear();
    vi.spyOn(os, "platform").mockReturnValue("win32");
    vi.spyOn(process, "cwd").mockReturnValue("C:\\project");
    vi.stubEnv("PATH", '"C:\\trusted";.;C:\\project');
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.stubEnv("ComSpec", "C:\\project\\cmd.exe");
    for (const file of ["C:\\trusted", "C:\\project", "C:\\Windows\\System32", "C:\\Windows\\System32\\cmd.exe", "C:\\project\\cmd.exe"]) {
      fixtures.set(canonical(file), "inert");
    }
    vi.spyOn(fs, "realpathSync").mockImplementation(((file: unknown) => {
      const key = canonical(String(file));
      if (fixtures.has(key)) return key;
      throw Object.assign(new Error("missing inert fixture"), { code: "ENOENT" });
    }) as typeof fs.realpathSync);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    vi.spyOn(fs, "accessSync").mockReturnValue(undefined);
    vi.spyOn(fs, "readFileSync").mockImplementation(((file: unknown) => fixtures.get(canonical(String(file)))!) as typeof fs.readFileSync);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["npm", "npm", "bin/npm-cli.js"],
    ["yarn", "corepack", "dist/yarn.js"],
    ["pnpm", "corepack", "dist/pnpm.js"],
  ] as const)("selects the canonical external Windows %s wrapper instead of its neighboring entrypoint", (manager, provider, entry) => {
    // Arrange: wrapper content is not parsed or executed.
    const root = `C:\\trusted\\node_modules\\${provider}`;
    const script = path.win32.join(root, entry);
    fixtures.set(canonical(`C:\\trusted\\${manager}.cmd`), "inert wrapper");
    fixtures.set(canonical(`${root}\\package.json`), JSON.stringify({ name: provider, bin: { [manager]: entry } }));
    fixtures.set(canonical(script), "inert JS");
    // Act / Assert
    expect(resolveTrustedPackageManager(manager)).toEqual({
      executable: canonical(`C:\\trusted\\${manager}.cmd`),
      args: [],
    });
  });

  it.each([
    ["COM before EXE", ".COM;.EXE;.BAT;.CMD", "func", ["func.com", "func.exe"], "func.com"],
    ["BAT before CMD", ".COM;.EXE;.BAT;.CMD", "func", ["func.bat", "func.cmd"], "func.bat"],
    ["caller CMD before EXE", ".CMD;.EXE;.COM;.BAT", "func", ["func.cmd", "func.exe"], "func.cmd"],
    ["case-insensitive order/name/suffix", ".cMd;.eXe;.cOm;.bAt", "FuNc", ["FuNc.CmD", "FuNc.ExE"], "FuNc.CmD"],
    ["explicit EXE does not append COM", ".COM;.EXE;.BAT;.CMD", "func.ExE", ["func.exe", "func.exe.com", "func.com"], "func.exe"],
    ["undeclared EXE is not a fallback", ".CMD", "func", ["func.exe"], undefined],
  ] as const)("caller PATHEXT lookup matches native cmd: %s", (_scenario, pathext, name, files, expected) => {
    vi.stubEnv("PATH", "C:\\trusted");
    vi.stubEnv("PATHEXT", pathext);
    for (const file of files) fixtures.set(canonical(path.win32.join("C:\\trusted", file)), "inert fixture");
    expect(resolveTrustedExecutable(name)).toBe(expected === undefined ? undefined : canonical(path.win32.join("C:\\trusted", expected)));
  });

  it("selects System32 cmd rather than project ComSpec for intentional commands", () => {
    // Arrange
    const command = "echo benign";
    // Act / Assert
    expect(createShellExecutionSpec(command, "C:\\project")).toEqual({
      executable: "c:\\windows\\system32\\cmd.exe",
      args: ["/d", "/s", "/c", `"${command}"`],
      cwd: "C:\\project",
      env: { ComSpec: "c:\\windows\\system32\\cmd.exe" },
      windowsVerbatimArguments: true,
    });
  });

  it("canonicalizes configured case-variant project PATH and ignores the same off-PATH tool", () => {
    // Arrange
    vi.stubEnv("PATH", "C:\\PROJECT\\tools");
    fixtures.set(canonical("C:\\project\\tools\\func.exe"), "inert");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe(canonical("C:\\project\\tools\\func.exe"));
    vi.stubEnv("PATH", "C:\\trusted");
    expect(resolveTrustedExecutable("func")).toBeUndefined();
  });
});

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

describe("trusted external wrapper compatibility (benign native fixtures)", () => {
  const fs = nativeModules["node:fs"].default;
  const os = nativeModules["node:os"].default;
  const path = nativeModules["node:path"].default;
  const process = nativeModules["node:process"].default;
  const { spawnSync } = nativeModules["node:child_process"];
  const { fileURLToPath } = nativeModules["node:url"];
  const recorder = fileURLToPath(new URL("../../../tests/fixtures/compatibility-recorder.cjs", import.meta.url));
  const windows = process.platform === "win32";
  let execInternalCommand: typeof import("./command.js").execInternalCommand;
  let createShellExecutionSpec: typeof import("./executable.js").createShellExecutionSpec;
  let prepareExecution: typeof import("./executable.js").prepareExecution;
  let probeExecutable: typeof import("./executable.js").probeExecutable;
  let resolveTrustedExecutable: typeof import("./executable.js").resolveTrustedExecutable;
  let resolveTrustedPackageManager: typeof import("./executable.js").resolveTrustedPackageManager;
  let sandbox: string;
  let project: string;
  let external: string;
  let report: string;
  let output: string;

  beforeEach(async () => {
    vi.resetModules();
    for (const [name, module] of Object.entries(nativeModules)) vi.doMock(name, () => module);
    vi.doMock("fs", () => nativeModules["node:fs"]);
    vi.doMock("child_process", () => nativeModules["node:child_process"]);
    vi.stubGlobal("process", process);
    ({ execInternalCommand } = await import("./command.js"));
    ({ createShellExecutionSpec, prepareExecution, probeExecutable, resolveTrustedExecutable, resolveTrustedPackageManager } = await import(
      "./executable.js"
    ));
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swa-wrapper-compat-"));
    project = path.join(sandbox, "project with spaces");
    external = path.join(sandbox, "external tools");
    report = path.join(sandbox, "launches.jsonl");
    output = path.join(sandbox, "wrapper stdout.txt");
    fs.mkdirSync(project);
    fs.mkdirSync(external);
    fs.copyFileSync(recorder, path.join(external, "record.cjs"));
    vi.stubEnv("PATH", [project, external, path.dirname(process.execPath)].join(path.delimiter));
    vi.stubEnv("SWA_COMPAT_REPORT", report);
    vi.stubEnv("SWA_COMPAT_CONTEXT", "inherited context");
    for (const key of ["SWA_COMPAT_WRAPPER", "SWA_COMPAT_PROBE", "SWA_COMPAT_EXIT", "NoDefaultCurrentDirectoryInExePath"]) {
      vi.stubEnv(key, "");
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(sandbox, { recursive: true });
    for (const [name, module] of Object.entries(fixtureModules)) vi.doMock(name, () => module);
    vi.doMock("fs", () => nodeFs);
    vi.doMock("child_process", () => fixtureChildProcess);
    vi.stubGlobal("process", simulatedProcess);
  });

  function wrapper(
    name: string,
    redirect = false,
    exit = 0,
    nestedNode = false,
    location = { directory: external, marker: "trusted external wrapper" },
  ) {
    const file = path.join(location.directory, windows ? `${name}.cmd` : name);
    const script = path.join(external, "record.cjs");
    const redirectOutput = redirect ? ` > "${output}"` : "";
    fs.writeFileSync(
      file,
      windows
        ? [
            "@ECHO OFF",
            "SETLOCAL",
            `SET "SWA_COMPAT_WRAPPER=${location.marker}"`,
            `SET "SWA_COMPAT_EXIT=${exit}"`,
            ...(nestedNode
              ? [
                  'SET "NODE_EXE=%~dp0node.exe"',
                  'IF NOT EXIST "%NODE_EXE%" SET "NODE_EXE=node"',
                  `FOR /F "delims=" %%F IN ('CALL "%NODE_EXE%" "${script}" --version') DO SET "SWA_COMPAT_PROBE=%%F"`,
                ]
              : [`SET "NODE_EXE=${process.execPath}"`]),
            `CALL "%NODE_EXE%" "${script}" --wrapper-flag %*${redirectOutput}`,
            "EXIT /B %ERRORLEVEL%",
            "",
          ].join("\r\n")
        : `#!/bin/sh\nSWA_COMPAT_WRAPPER="${location.marker}" SWA_COMPAT_EXIT=${exit} ${nestedNode ? "node" : `"${process.execPath}"`} "${script}" --wrapper-flag "$@"${redirectOutput}\n`,
      { mode: 0o755 },
    );
    return fs.realpathSync(file);
  }

  function packageEntrypoint() {
    const root = path.join(external, "node_modules", "npm");
    fs.mkdirSync(path.join(root, "bin"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "npm", bin: { npm: "bin/npm-cli.js" } }));
    fs.copyFileSync(recorder, path.join(root, "bin", "npm-cli.js"));
  }

  function records(): { execPath: string; args: string[]; cwd: string; wrapper: string | null; probe: string | null; context: string }[] {
    return fs
      .readFileSync(report, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }

  function executeWithStatus(execution: InternalExecutionSpec): number {
    try {
      execInternalCommand(execution);
      return 0;
    } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || typeof error.status !== "number") throw error;
      return error.status;
    }
  }

  it("executes the selected package wrapper instead of bypassing its flags, redirection, env and exit status", () => {
    const selected = wrapper("npm", true, 17);
    packageEntrypoint();
    const control = createShellExecutionSpec(`"${selected}" install`, project);
    const child = spawnSync(control.executable, control.args, {
      cwd: control.cwd,
      env: process.env,
      shell: false,
      windowsVerbatimArguments: control.windowsVerbatimArguments,
      timeout: 5000,
    });
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(17);
    expect(records().at(-1)).toMatchObject({ args: ["--wrapper-flag", "install"], wrapper: "trusted external wrapper" });
    expect(fs.readFileSync(output, "utf8").trim()).toBe("compatibility wrapper stdout");
    fs.writeFileSync(report, "");
    fs.unlinkSync(output);
    const execution = resolveTrustedPackageManager("npm");
    const status = executeWithStatus({ ...execution, args: [...execution.args, "install"], cwd: project });
    expect({
      status,
      launch: records().at(-1),
      stdout: fs.existsSync(output) ? fs.readFileSync(output, "utf8").trim() : undefined,
    }).toEqual({
      status: 17,
      launch: {
        execPath: process.execPath,
        args: ["--wrapper-flag", "install"],
        cwd: fs.realpathSync(project),
        wrapper: "trusted external wrapper",
        probe: null,
        context: "inherited context",
      },
      stdout: "compatibility wrapper stdout",
    });
  });

  it.each([
    ["func", "4.0.0"],
    ["dab", "Microsoft.DataApiBuilder 1.2.3"],
  ])("executes the same trusted %s wrapper for version probing and launch", async (tool, version) => {
    const expected = wrapper(tool);
    vi.stubEnv("SWA_COMPAT_VERSION", version);
    const resolutionOptions = {};
    const executable = resolveTrustedExecutable(tool, resolutionOptions);
    expect(executable).toBe(expected);
    if (!executable) throw new Error(`Missing fixture wrapper for ${tool}.`);
    expect((await probeExecutable(executable, ["--version"], resolutionOptions)).stdout.trim()).toBe(version);
    execInternalCommand({ executable, args: ["start"], cwd: project });
    expect(records()).toEqual([
      {
        execPath: process.execPath,
        args: ["--wrapper-flag", "--version"],
        cwd: fs.realpathSync(process.cwd()),
        wrapper: "trusted external wrapper",
        probe: null,
        context: "inherited context",
      },
      {
        execPath: process.execPath,
        args: ["--wrapper-flag", "start"],
        cwd: fs.realpathSync(project),
        wrapper: "trusted external wrapper",
        probe: null,
        context: "inherited context",
      },
    ]);
  });

  it.each([
    ["func", "4.0.0"],
    ["dab", "Microsoft.DataApiBuilder 1.2.3"],
    ["npm", "10.8.2"],
  ])("honors caller's explicit absolute project PATH order for %s probe and launch", async (tool, version) => {
    const local = path.join(project, tool === "npm" ? "node_modules/.bin" : ".tools");
    fs.mkdirSync(local, { recursive: true });
    const marker = "first caller PATH wrapper";
    const command = tool === "npm" ? "install" : "start";
    const status = tool === "npm" ? 17 : 0;
    const expected = wrapper(tool, tool === "npm", status, false, { directory: local, marker });
    wrapper(tool, tool === "npm", status);
    const callerPath = [local, external, path.dirname(process.execPath)].join(path.delimiter);
    vi.stubEnv("PATH", callerPath);
    vi.stubEnv("SWA_COMPAT_VERSION", version);
    const resolutionOptions = {};

    const baseline = createShellExecutionSpec(`"${tool}" ${command}`, project);
    const control = spawnSync(baseline.executable, baseline.args, {
      cwd: project,
      env: { ...process.env, ...baseline.env },
      shell: false,
      windowsVerbatimArguments: baseline.windowsVerbatimArguments,
      timeout: 5000,
    });
    expect(control.error).toBeUndefined();
    expect(control.status).toBe(status);
    expect(records().at(-1)?.wrapper).toBe(marker);
    fs.writeFileSync(report, "");

    const execution =
      tool === "npm"
        ? resolveTrustedPackageManager("npm", resolutionOptions)
        : { executable: resolveTrustedExecutable(tool, resolutionOptions)!, args: [] };
    const probe = await probeExecutable(execution.executable, ["--version"], resolutionOptions);
    const actualStatus = executeWithStatus({ ...execution, args: [command], cwd: project });
    const observed = records();
    expect({
      canonical: execution.executable,
      wrappers: observed.map((record) => record.wrapper),
      args: observed.map((record) => record.args),
      identities: observed.map((record) => record.execPath),
      cwds: observed.map((record) => record.cwd),
      probe: probe.stdout.trim(),
      status: actualStatus,
      callerPath: process.env.PATH,
      redirected: tool === "npm" ? fs.readFileSync(output, "utf8").trim() : undefined,
    }).toEqual({
      canonical: expected,
      wrappers: [marker, marker],
      args: [
        ["--wrapper-flag", "--version"],
        ["--wrapper-flag", command],
      ],
      identities: [process.execPath, process.execPath],
      cwds: [fs.realpathSync(process.cwd()), fs.realpathSync(project)],
      probe: tool === "npm" ? "" : version,
      status,
      callerPath,
      redirected: tool === "npm" ? "compatibility wrapper stdout" : undefined,
    });
  });

  it("binds relative caller PATH and the version probe to the tool's operation cwd", async () => {
    const runtime = path.join(project, "runtime tools");
    fs.mkdirSync(runtime);
    fs.writeFileSync(
      path.join(runtime, windows ? "node.cmd" : "node"),
      windows
        ? `@ECHO OFF\r\nSETLOCAL\r\nSET "SWA_COMPAT_CONTEXT=relative PATH loader"\r\nCALL "${process.execPath}" %*\r\nEXIT /B %ERRORLEVEL%\r\n`
        : `#!/bin/sh\nSWA_COMPAT_CONTEXT="relative PATH loader" exec "${process.execPath}" "$@"\n`,
      { mode: 0o755 },
    );
    const expected = wrapper("func", false, 0, true);
    const callerPath = [path.relative(project, external), path.relative(project, runtime)].join(path.delimiter);
    vi.stubEnv("PATH", callerPath);
    vi.stubEnv("SWA_COMPAT_VERSION", "4.0.0");
    const resolutionOptions = { cwd: project };
    const executable = resolveTrustedExecutable("func", resolutionOptions);
    expect(executable).toBe(expected);
    if (!executable) throw new Error("Missing relative PATH fixture.");
    expect((await probeExecutable(executable, ["--version"], resolutionOptions)).stdout.trim()).toBe("4.0.0");
    execInternalCommand({ executable, args: ["start"], cwd: project });
    const argv = windows
      ? [["--version"], ["--wrapper-flag", "--version"], ["--version"], ["--wrapper-flag", "start"]]
      : [
          ["--wrapper-flag", "--version"],
          ["--wrapper-flag", "start"],
        ];
    expect(records().map(({ execPath, args, cwd, context }) => ({ execPath, args, cwd, context }))).toEqual(
      argv.map((args) => ({ execPath: process.execPath, args, cwd: fs.realpathSync(project), context: "relative PATH loader" })),
    );
    expect(process.env.PATH).toBe(callerPath);
  });

  it.skipIf(!windows)(
    "native Windows: off-PATH CWD canaries cannot preempt wrappers or fixed cmd/Node loaders",
    () => {
      const resolutionOptions = { cwd: project };
      const trustedCmd = createShellExecutionSpec("echo fixture", project).executable;
      fs.copyFileSync(process.execPath, path.join(project, "node.exe"));
      fs.copyFileSync(trustedCmd, path.join(project, "cmd.exe"));
      for (const name of ["func", "dab", "npm"]) {
        wrapper(name, false, 0, false, { directory: project, marker: "off-PATH CWD canary" });
      }
      vi.stubEnv("PATH", [external, path.dirname(process.execPath)].join(path.delimiter));
      vi.stubEnv("ComSpec", path.join(project, "cmd.exe"));
      vi.stubEnv("SWA_COMPAT_VERSION", "4.0.0");
      for (const name of ["func", "dab", "npm"]) {
        const expected = wrapper(name, name === "npm", 0, true);
        fs.writeFileSync(report, "");
        const selected =
          name === "npm" ? resolveTrustedPackageManager("npm", resolutionOptions).executable : resolveTrustedExecutable(name, resolutionOptions)!;
        const prepared = prepareExecution({ executable: selected, args: ["start"], cwd: project });
        expect(prepared.executable).toBe(trustedCmd);
        expect(prepared.env?.ComSpec).toBe(trustedCmd);
        execInternalCommand(prepared);
        expect(selected).toBe(expected);
        const observed = records();
        expect(observed.map((record) => record.execPath.toLowerCase())).toEqual([process.execPath.toLowerCase(), process.execPath.toLowerCase()]);
        expect(observed.map((record) => record.cwd)).toEqual([fs.realpathSync(project), fs.realpathSync(project)]);
        expect(observed.map((record) => record.args)).toEqual([["--version"], ["--wrapper-flag", "start"]]);
        expect(observed[1].wrapper).toBe("trusted external wrapper");
        expect(observed[1].probe).toBe("4.0.0");
      }
    },
    15000,
  );

  it.skipIf(!windows)(
    "native Windows: future configured PATH aliases and global alternatives never add off-PATH CWD",
    () => {
      fs.copyFileSync(process.execPath, path.join(project, "node.exe"));
      wrapper("npm", true, 0, true);
      packageEntrypoint();
      vi.stubEnv("SWA_COMPAT_VERSION", "4.0.0");
      const alias = path.join(sandbox, "project junction");
      const missingProjectChild = path.join(alias, "created after binding");
      const futureGlobal = path.join(external, "future global");
      fs.symlinkSync(project, alias, "junction");
      vi.stubEnv("PATH", [missingProjectChild, futureGlobal, external, path.dirname(process.execPath)].join(path.delimiter));
      expect(fs.existsSync(path.join(external, "node.exe"))).toBe(false);
      const execution = resolveTrustedPackageManager("npm");
      const prepared = prepareExecution({ ...execution, args: [...execution.args, "install"], cwd: project });
      fs.mkdirSync(missingProjectChild);
      fs.linkSync(path.join(project, "node.exe"), path.join(missingProjectChild, "node.exe"));
      fs.mkdirSync(futureGlobal);
      const trustedNode = path.join(futureGlobal, "node.exe");
      fs.copyFileSync(process.execPath, trustedNode);
      vi.stubEnv("PATH", [futureGlobal, external, path.dirname(process.execPath)].join(path.delimiter));
      const alternatives = [
        { execution: prepared, node: path.join(missingProjectChild, "node.exe") },
        { execution: prepareExecution({ ...execution, args: ["install"], cwd: project }), node: trustedNode },
      ];
      for (const { execution: bound, node } of alternatives) {
        fs.writeFileSync(report, "");
        execInternalCommand(bound);
        expect(records().map((record) => ({ ...record, execPath: fs.realpathSync(record.execPath).toLowerCase() }))).toEqual([
          {
            execPath: fs.realpathSync(node).toLowerCase(),
            args: ["--version"],
            cwd: fs.realpathSync(project),
            wrapper: "trusted external wrapper",
            probe: null,
            context: "inherited context",
          },
          {
            execPath: fs.realpathSync(node).toLowerCase(),
            args: ["--wrapper-flag", "install"],
            cwd: fs.realpathSync(project),
            wrapper: "trusted external wrapper",
            probe: "4.0.0",
            context: "inherited context",
          },
        ]);
      }
    },
    15000,
  );
});
