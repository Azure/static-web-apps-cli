import mockFs from "mock-fs";
import { build } from "./build";
import { DEFAULT_CONFIG } from "../../config";
import { convertToNativePaths } from "../../jest.helpers.";

jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

describe("swa build", () => {
  afterEach(() => {
    mockFs.restore();
    const execSyncMock = jest.requireMock("child_process").execSync;
    execSyncMock.mockReset();
  });

  it("should run app build command", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs();

    await build({ ...DEFAULT_CONFIG, appBuildCommand: "npm run something" });
    expect(execSyncMock.mock.calls[0][0]).toBe("npm run something");
  });

  it("should run npm install before build command", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs({ "package.json": {} });

    await build({ ...DEFAULT_CONFIG, appBuildCommand: "npm run something" });
    expect(execSyncMock.mock.calls[0][0]).toBe("npm install");
    expect(execSyncMock.mock.calls[1][0]).toBe("npm run something");
  });

  it("should run command in package.json path", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs({ [convertToNativePaths("app/package.json")]: {} });

    await build({
      ...DEFAULT_CONFIG,
      outputLocation: convertToNativePaths("app/dist"),
      appBuildCommand: "npm run something",
    });
    expect(execSyncMock.mock.calls[0][1].cwd).toBe("app");
  });

  it("should run api build command", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs();

    await build({ ...DEFAULT_CONFIG, apiLocation: "api", apiBuildCommand: "npm run something" });
    expect(execSyncMock.mock.calls[0][0]).toBe("npm run something");
  });

  it("should run npm install before build command", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs({ "api/package.json": {} });

    await build({ ...DEFAULT_CONFIG, apiLocation: "api", apiBuildCommand: "npm run something" });
    expect(execSyncMock.mock.calls[0][0]).toBe("npm install");
    expect(execSyncMock.mock.calls[1][0]).toBe("npm run something");
  });

  it("should run command in package.json path", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs({ [convertToNativePaths("api/package.json")]: {} });

    await build({
      ...DEFAULT_CONFIG,
      apiLocation: "api",
      apiBuildCommand: "npm run something",
    });
    expect(execSyncMock.mock.calls[0][1].cwd).toBe("api");
  });

  it("should run nothing", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs();

    await build({ ...DEFAULT_CONFIG });
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it("should detect build config and run commands", async () => {
    const execSyncMock = jest.requireMock("child_process").execSync;
    mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });

    await build({ ...DEFAULT_CONFIG, auto: true });
    expect(execSyncMock.mock.calls[0][0]).toBe("npm install");
    expect(execSyncMock.mock.calls[0][1].cwd).toBe(convertToNativePaths("src/node-ts"));
    expect(execSyncMock.mock.calls[1][0]).toBe("npm run build --if-present");
    expect(execSyncMock.mock.calls[1][1].cwd).toBe(convertToNativePaths("src/node-ts"));
  });
});
