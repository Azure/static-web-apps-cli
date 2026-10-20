import "../../../tests/_mocks/fs.js";
import "../../../tests/_mocks/posix.js";
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
} from "./executable.js";

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
