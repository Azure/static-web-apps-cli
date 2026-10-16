import "../../../tests/_mocks/fs.js";
import "../../../tests/_mocks/posix.js";
import { fs, vol } from "memfs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  assertAbsoluteExecutable,
  createShellExecutionSpec,
  resolveManagedExecutable,
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

  it("ignores empty, relative, cwd and project-descendant PATH entries", () => {
    // Arrange
    vi.stubEnv("PATH", ":.:tools:/project:/project/tools:/trusted/bin");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe("/trusted/bin/func");
  });

  it("rejects a PATH alias to project descendants", () => {
    // Arrange
    fs.symlinkSync("/project/tools", "/alias");
    vi.stubEnv("PATH", "/alias");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBeUndefined();
  });

  it("rejects aliases of separately supplied API roots", () => {
    // Arrange
    vol.fromJSON({ "/api-root/bin/func": "inert" });
    fs.chmodSync("/api-root/bin/func", 0o755);
    fs.symlinkSync("/api-root", "/api-alias");
    vi.stubEnv("PATH", "/api-root/bin");
    // Act / Assert
    expect(resolveTrustedExecutable("func", { untrustedRoots: ["/api-alias"] })).toBeUndefined();
  });

  it("does not confuse a project-prefix sibling with a descendant", () => {
    // Arrange
    vol.fromJSON({ "/project-tools/func": "inert" });
    fs.chmodSync("/project-tools/func", 0o755);
    vi.stubEnv("PATH", "/project-tools");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBe("/project-tools/func");
  });

  it("rejects a managed missing-file path whose existing parent aliases the project", () => {
    // Arrange
    fs.symlinkSync("/project", "/cache-alias");
    // Act / Assert
    expect(() => resolveManagedExecutable("/cache-alias/not-downloaded/func")).toThrow(/inside the project/);
  });

  it("binds a missing managed filename to its trusted canonical parent", () => {
    // Arrange
    fs.symlinkSync("/trusted", "/cache-alias");
    // Act / Assert
    expect(resolveManagedExecutable("/cache-alias/new/version/func")).toBe("/trusted/new/version/func");
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

  it("fails closed when a supplied exclusion root cannot be canonicalized", () => {
    // Arrange
    vi.stubEnv("PATH", "/trusted/bin");
    const realpath = fs.realpathSync.bind(fs);
    vi.spyOn(fs, "realpathSync").mockImplementation((file, ...args) => {
      if (String(file) === "/denied-root") throw Object.assign(new Error("denied"), { code: "EACCES" });
      return realpath(file, ...args);
    });
    // Act / Assert
    expect(() => resolveTrustedExecutable("func", { untrustedRoots: ["/denied-root"] })).toThrow("denied");
  });

  it("rejects unknown interpreter scripts instead of executing their shebang", () => {
    // Arrange
    vol.fromJSON({ "/trusted/bin/func": "#!/usr/bin/env node\ninert" });
    fs.chmodSync("/trusted/bin/func", 0o755);
    vi.stubEnv("PATH", "/trusted/bin");
    // Act / Assert
    expect(() => resolveTrustedExecutable("func")).toThrow(/Unsupported internal tool script/);
  });

  it.each(["func", "./func", "/trusted/tool.cmd", "/trusted/tool.bat", "/trusted/tool.ps1"])(
    "refuses a relative identity or shell shim: %s",
    (file) => {
      // Arrange / Act / Assert
      expect(() => assertAbsoluteExecutable(file)).toThrow();
    },
  );

  it.each(["yarn", "pnpm"] as const)("binds a known %s Corepack script to current Node", (manager) => {
    // Arrange
    const script = `/trusted/bin/node_modules/corepack/dist/${manager}.js`;
    vol.fromJSON({
      "/trusted/bin/node_modules/corepack/package.json": JSON.stringify({ name: "corepack", bin: { [manager]: `./dist/${manager}.js` } }),
      [script]: "inert JS fixture",
    });
    vi.stubEnv("PATH", "/trusted/bin");
    // Act / Assert
    expect(resolveTrustedPackageManager(manager)).toEqual({ executable: process.execPath, args: [script] });
  });

  it("rejects a recognized package entrypoint aliased into the project", () => {
    // Arrange
    vol.fromJSON({
      "/trusted/bin/node_modules/npm/package.json": JSON.stringify({ name: "npm", bin: { npm: "bin/npm-cli.js" } }),
      "/project/npm-cli.js": "inert JS fixture",
    });
    fs.mkdirSync("/trusted/bin/node_modules/npm/bin");
    fs.symlinkSync("/project/npm-cli.js", "/trusted/bin/node_modules/npm/bin/npm-cli.js");
    vi.stubEnv("PATH", "/trusted/bin");
    // Act / Assert
    expect(() => resolveTrustedPackageManager("npm")).toThrow(/Cannot find a supported npm/);
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
    for (const file of ["C:\\Windows\\System32\\cmd.exe", "C:\\project\\cmd.exe"]) fixtures.set(canonical(file), "inert");
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
  ] as const)("binds a standard Windows %s shim to current Node and recognized script", (manager, provider, entry) => {
    // Arrange: wrapper content is not parsed or executed.
    const root = `C:\\trusted\\node_modules\\${provider}`;
    const script = path.win32.join(root, entry);
    fixtures.set(canonical(`C:\\trusted\\${manager}.cmd`), "inert wrapper");
    fixtures.set(canonical(`${root}\\package.json`), JSON.stringify({ name: provider, bin: { [manager]: entry } }));
    fixtures.set(canonical(script), "inert JS");
    // Act / Assert
    expect(resolveTrustedPackageManager(manager)).toEqual({ executable: process.execPath, args: [canonical(script)] });
  });

  it("selects System32 cmd rather than project ComSpec for intentional commands", () => {
    // Arrange
    const command = "echo benign";
    // Act / Assert
    expect(createShellExecutionSpec(command, "C:\\project")).toEqual({
      executable: "c:\\windows\\system32\\cmd.exe",
      args: ["/d", "/s", "/c", `"${command}"`],
      cwd: "C:\\project",
      windowsVerbatimArguments: true,
    });
  });

  it("rejects case-variant project descendants", () => {
    // Arrange
    vi.stubEnv("PATH", "C:\\PROJECT\\tools");
    fixtures.set(canonical("C:\\project\\tools\\func.exe"), "inert");
    // Act / Assert
    expect(resolveTrustedExecutable("func")).toBeUndefined();
  });
});
