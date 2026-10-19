import "../../../../tests/_mocks/fs.js";
import "../../../../tests/_mocks/posix.js";
import { vol, fs } from "memfs";
import path from "node:path";
import process from "node:process";
import { build } from "./build.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { convertToNativePaths } from "../../../test.helpers.js";

vi.mock("../../../core/utils/logger", () => {
  return {
    logger: {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      silly: vi.fn(),
    },
  };
});
vi.mock("../../../core/utils/command.js");

describe("swa build", () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({ "/trusted/bin/npm": "inert native fixture; never executed" });
    fs.chmodSync("/trusted/bin/npm", 0o755);
    vi.stubEnv("PATH", "/trusted/bin");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const contextFor = (cwd: string) => ({ untrustedRoots: expect.arrayContaining([path.resolve(cwd)]) });

  it("should run app build command", async () => {
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());

    await build({ ...DEFAULT_CONFIG, appBuildCommand: "npm run something" });
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".", contextFor("."));
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
      resolutionOptions: { ...contextFor("."), cwd: process.cwd() },
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".", contextFor("."));
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
      resolutionOptions: { ...contextFor("."), cwd: path.resolve("app") },
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".", contextFor("."));
    expect(vi.mocked(command.execInternalCommand).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(command.runCommand).mock.invocationCallOrder[0],
    );
  });

  it("should run api build command", async () => {
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());
    await build({ ...DEFAULT_CONFIG, apiLocation: "api", apiBuildCommand: "npm run something" });

    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api", contextFor("api"));
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
      resolutionOptions: { ...contextFor("api"), cwd: path.resolve("api") },
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api", contextFor("api"));
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
      resolutionOptions: { ...contextFor("api"), cwd: path.resolve("api") },
    });
    expect(command.runCommand).toHaveBeenCalledTimes(1);
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api", contextFor("api"));
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
