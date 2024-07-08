import mockFs from "mock-fs";
import cp from "node:child_process";
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
    logGitHubIssueMessageAndExit: vi.fn()
  };
});

describe("swa build", () => {
  afterEach(() => {
    mockFs.restore();
  });

  it("should run app build command", async () => {
    const { execSync } = await vi.importMock("child_process");
    mockFs();

    await build({ ...DEFAULT_CONFIG, appBuildCommand: "npm run something" });
    expect(execSync).toHaveBeenCalledWith("npm run something");
  });

  it("should run npm install before build command", async () => {
    const { execSync } = await vi.importMock("child_process");
    mockFs({ "package.json": {} });

    await build({ ...DEFAULT_CONFIG, appBuildCommand: "npm run something" });
    expect(execSync).toHaveBeenCalledWith("npm install");
    expect(execSync).toHaveBeenCalledWith("npm run something");
  });

  it("should run command in package.json path", async () => {
    const { execSync } = await vi.importMock("child_process");
    mockFs({ [convertToNativePaths("app/package.json")]: {} });

    await build({
      ...DEFAULT_CONFIG,
      outputLocation: convertToNativePaths("app/dist"),
      appBuildCommand: "npm run something",
    });
    expect(execSync).toHaveBeenCalledWith("npm run something", { cwd: "app" });
  });

  it("should run api build command", async () => {
    const { execSync } = await vi.importMock("child_process");
    mockFs();

    await build({ ...DEFAULT_CONFIG, apiLocation: "api", apiBuildCommand: "npm run something" });
    expect(execSync).toHaveBeenCalledWith("npm run something");
  });

  it("should run npm install before build command", async () => {
    const { execSync } = await vi.importMock("child_process");
    mockFs({ "api/package.json": {} });

    await build({ ...DEFAULT_CONFIG, apiLocation: "api", apiBuildCommand: "npm run something" });
    expect(execSync).toBeCalledTimes(2);
    expect(execSync).toHaveBeenCalledWith("npm install");
    expect(execSync).toHaveBeenCalledWith("npm run something");
  });

  it("should run command in package.json path", async () => {
    const { execSync } = await vi.importMock("child_process");
    mockFs({ [convertToNativePaths("api/package.json")]: {} });

    await build({
      ...DEFAULT_CONFIG,
      apiLocation: "api",
      apiBuildCommand: "npm run something",
    });
    expect(execSync).toHaveBeenCalledWith("npm run something", { cwd: "api" });
  });

  it("should run nothing", async () => {
    const { execSync } = await vi.importMock("child_process");
    mockFs();

    await build({ ...DEFAULT_CONFIG });
    expect(execSync).not.toHaveBeenCalled();
  });

  it("should detect build config and run commands", async () => {
    const execSyncMock = vi.spyOn(cp, "execSync");
    mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });

    await build({ ...DEFAULT_CONFIG, auto: true });
    expect(execSyncMock).toHaveBeenCalledTimes(2);
    expect(execSyncMock).toHaveBeenCalledWith("npm install", { cwd: convertToNativePaths("src/node-ts") });
    expect(execSyncMock).toHaveBeenCalledWith("npm run build --if-present", { cwd: convertToNativePaths("src/node-ts") });
  });
});
