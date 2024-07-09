import "../../../../tests/_mocks/fs.js";
import { vol } from "memfs";
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    expect(command.runCommand).toHaveBeenCalledWith("npm install", ".");
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".");
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

    expect(command.runCommand).toHaveBeenCalledWith("npm install", "app");
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", ".");
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

    expect(command.runCommand).toBeCalledTimes(2);
    expect(command.runCommand).toHaveBeenCalledWith("npm install", "api");
    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api");
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

    expect(command.runCommand).toHaveBeenCalledWith("npm run something", "api");
  });

  it("should run nothing", async () => {
    const command = await import("../../../core/utils/command.js");
    command.runCommand = vi.fn().mockImplementation(vi.fn());
    await build({ ...DEFAULT_CONFIG });

    expect(command.runCommand).not.toHaveBeenCalled();
  });

  // JEST-TODO: Use unionfs combined with memfs to simulate mockFs.load
  // it("should detect build config and run commands", async () => {
  //   const execSyncMock = vi.spyOn(cp, "execSync");
  //   mockFs({
  //     src: mockFs.load("e2e/fixtures/static-node-ts")
  //   });

  //   await build({ ...DEFAULT_CONFIG, auto: true });
  //   expect(execSyncMock).toHaveBeenCalledTimes(2);
  //   expect(execSyncMock).toHaveBeenCalledWith("npm install", { cwd: convertToNativePaths("src/node-ts") });
  //   expect(execSyncMock).toHaveBeenCalledWith("npm run build --if-present", { cwd: convertToNativePaths("src/node-ts") });
  // });
});
