import "../../../../tests/_mocks/fs.js";
import "../../../../tests/_mocks/posix.js";
import { childProcess, directLaunches, mockInternalProcesses } from "../../../../tests/_mocks/internal-process.js";
import { vol, fs } from "memfs";
import path from "node:path";
import process from "node:process";
import { DEFAULT_CONFIG } from "../../../config.js";
import { convertToNativePaths } from "../../../test.helpers.js";

describe("swa build", () => {
  let build: typeof import("./build.js").build;

  beforeEach(async () => {
    vi.resetModules();
    for (const module of [
      "../../../core/utils/workflow-config.js",
      "../../../core/utils/options.js",
      "../../../core/utils/file.js",
      "../../../core/frameworks/detect.js",
    ])
      vi.doUnmock(module);
    vi.doMock("../../../core/utils/logger.js", () => ({
      logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn(), silly: vi.fn() },
    }));
    vi.doMock("../../../core/utils/command.js");
    ({ build } = await import("./build.js"));
    vol.reset();
    vol.fromJSON({ "/trusted/bin/npm": "inert native fixture; never executed" });
    fs.chmodSync("/trusted/bin/npm", 0o755);
    vi.stubEnv("PATH", "/trusted/bin");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should run app build command", async () => {
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());

    await build({ ...DEFAULT_CONFIG, appBuildCommand: "npm run something" });
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".");
  });

  it("should run npm install before build command", async () => {
    vol.fromNestedJSON({ "package.json": "{}" });
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());

    await build({ ...DEFAULT_CONFIG, appBuildCommand: "npm run something" });

    expect(command.execInternalCommand).toHaveBeenCalledWith({
      executable: "/trusted/bin/npm",
      args: ["install"],
      cwd: process.cwd(),
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".");
    expect(vi.mocked(command.execInternalCommand).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(command.runCommand).mock.invocationCallOrder[0],
    );
  });

  it("should run command in package.json path", async () => {
    vol.fromNestedJSON({ [convertToNativePaths("app/package.json")]: "{}" });
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());

    await build({
      ...DEFAULT_CONFIG,
      outputLocation: convertToNativePaths("app/dist"),
      appBuildCommand: "npm run something",
    });

    expect(command.execInternalCommand).toHaveBeenCalledWith({
      executable: "/trusted/bin/npm",
      args: ["install"],
      cwd: path.resolve("app"),
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".");
    expect(vi.mocked(command.execInternalCommand).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(command.runCommand).mock.invocationCallOrder[0],
    );
  });

  it("should run api build command", async () => {
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());
    await build({ ...DEFAULT_CONFIG, apiLocation: "api", apiBuildCommand: "npm run something" });

    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api");
  });

  it("should run npm install before build command", async () => {
    vol.fromNestedJSON({ "api/package.json": "{}" });
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());

    await build({ ...DEFAULT_CONFIG, apiLocation: "api", apiBuildCommand: "npm run something" });

    expect(command.execInternalCommand).toHaveBeenCalledWith({
      executable: "/trusted/bin/npm",
      args: ["install"],
      cwd: path.resolve("api"),
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api");
    expect(vi.mocked(command.execInternalCommand).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(command.runCommand).mock.invocationCallOrder[0],
    );
  });

  it("should run command in package.json path", async () => {
    vol.fromNestedJSON({ [convertToNativePaths("api/package.json")]: "{}" });
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());

    await build({
      ...DEFAULT_CONFIG,
      apiLocation: "api",
      apiBuildCommand: "npm run something",
    });

    expect(command.execInternalCommand).toHaveBeenCalledWith({
      executable: "/trusted/bin/npm",
      args: ["install"],
      cwd: path.resolve("api"),
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api");
  });

  it("should run nothing", async () => {
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());
    await build({ ...DEFAULT_CONFIG });

    expect(command.runCommand).not.toHaveBeenCalled();
  });

  // SKIPPED: Cannot mock execSync; need to set up unionfs for loading real file system.
  it.skip("should detect build config and run commands", () => {
    //const execSyncMock = vi.spyOn(cp, "execSync");
    // mockFs({
    //   src: mockFs.load("e2e/fixtures/static-node-ts")
    // });
    // await build({ ...DEFAULT_CONFIG, auto: true });
    // expect(execSyncMock).toHaveBeenCalledTimes(2);
    // expect(execSyncMock).toHaveBeenCalledWith("npm install", { cwd: convertToNativePaths("src/node-ts") });
    // expect(execSyncMock).toHaveBeenCalledWith("npm run build --if-present", { cwd: convertToNativePaths("src/node-ts") });
  });
});

describe("automatic dependency installs are internal, user build strings are deliberate", () => {
  let build: typeof import("./build.js").build;

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock("../../../core/utils/command.js");
    vi.doMock("../../../core/utils/workflow-config.js", () => ({ readWorkflowFile: () => undefined }));
    vi.doMock("../../../core/utils/options.js", () => ({ isUserOrConfigOption: () => false }));
    vi.doMock("../../../core/utils/file.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../../core/utils/file.js")>()),
      // Preserve the original finder isolation, independently of command execution.
      findUpPackageJsonDir: async () => "/workspace/app",
    }));
    vi.doMock("../../../core/utils/logger.js", () => ({
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), silly: vi.fn() },
    }));
    vi.doMock("../../../core/frameworks/detect.js", () => ({ detectProjectFolders: vi.fn(), generateConfiguration: vi.fn() }));
    ({ build } = await import("./build.js"));
    vol.reset();
    mockInternalProcesses();
    vi.spyOn(process, "cwd").mockReturnValue("/workspace");
    vi.stubEnv("PATH", "/trusted/bin");
    vol.fromJSON({
      "/bin/sh": "inert system-shell fixture; never executed",
      "/workspace/app/package.json": "{}",
      "/trusted/bin/npm": "inert fixture",
      "/trusted/bin/yarn": "inert fixture",
      "/trusted/bin/pnpm": "inert fixture",
      "/workspace/npm": "inert fixture",
      "/workspace/yarn": "inert fixture",
      "/workspace/pnpm": "inert fixture",
      "/workspace/app/npm": "inert off-PATH fixture",
      "/workspace/app/yarn": "inert off-PATH fixture",
      "/workspace/app/pnpm": "inert off-PATH fixture",
      "/workspace/app/.tools/npm": "inert configured fixture",
      "/workspace/app/.tools/yarn": "inert configured fixture",
      "/workspace/app/.tools/pnpm": "inert configured fixture",
    });
    for (const file of Object.keys(vol.toJSON())) fs.chmodSync(file, 0o755);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["npm", "package-lock.json"],
    ["yarn", "yarn.lock"],
    ["pnpm", "pnpm-lock.yaml"],
  ])("runs automatic %s install through the caller-selected identity without off-PATH CWD preemption", async (manager, lock) => {
    vol.fromJSON({ [`/workspace/app/${lock}`]: "" });
    for (const directory of ["/trusted/bin", "/workspace/app/.tools"]) {
      vi.stubEnv("PATH", directory === "/trusted/bin" ? directory : `${directory}:/trusted/bin`);
      await build({ ...DEFAULT_CONFIG, appLocation: "/workspace/app", outputLocation: ".", appBuildCommand: "npm run build && echo done" });
      expect(childProcess.execSync.mock.calls.map(([command]) => command)).not.toContain(`${manager} install`);
      const launches = directLaunches().map(({ file, args, options }) => ({ file, args, cwd: options?.cwd }));
      expect(launches).toContainEqual({ file: `${directory}/${manager}`, args: ["install"], cwd: "/workspace/app" });
      expect(launches.some(({ file }) => file === `/workspace/app/${manager}` || file === `/workspace/${manager}`)).toBe(false);
    }
  });

  it("preserves an explicit user build command as a shell string", async () => {
    const command = "npm run build && echo done";
    await build({ ...DEFAULT_CONFIG, appLocation: "/workspace/app", outputLocation: ".", appBuildCommand: command });
    expect(childProcess.execSync).toHaveBeenCalledWith(command, expect.objectContaining({ cwd: "/workspace/app", shell: "/bin/sh" }));
  });
});
