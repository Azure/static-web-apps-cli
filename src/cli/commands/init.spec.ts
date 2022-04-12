import fs from "fs";
import mockFs from "mock-fs";
import { init } from "./init";
import { DEFAULT_CONFIG } from "../../config";
import { swaCliConfigFilename } from "../../core/utils";

jest.mock("prompts", () => jest.fn());
jest.mock("../../config", () => {
  return {
    DEFAULT_CONFIG: {
      appLocation: "/foobar",
      outputLocation: "/foobar",
      appBuildCommand: "npm run build --if-present",
      apiBuildCommand: "npm run build --if-present",
    },
  };
});

const defaultCliConfig = {
  ...DEFAULT_CONFIG,
  config: swaCliConfigFilename,
};

const defautResolvedPrompts = {
  projectName: "test-project",
  appLocation: "./app",
  apiLocation: "./api",
  outputLocation: "./dist",
  appBuildCommand: "npm run build",
  apiBuildCommand: "npm run build:api",
  devServerCommand: "npm run dev",
  devServerUrl: "http://localhost:3000",
  confirmOverwrite: true,
};

describe("swa init", () => {
  afterEach(() => {
    mockFs.restore();
    const promptsMock = jest.requireMock("prompts");
    promptsMock.mockReset();
  });

  it("should create a config file", async () => {
    mockFs();

    await init("test", { ...defaultCliConfig, yes: true });
    const configFile = fs.readFileSync(defaultCliConfig.config, "utf-8");

    expect(configFile).toMatchInlineSnapshot(`
      "{
        \\"$schema\\": \\"https://aka.ms/azure/static-web-apps-cli/schema\\",
        \\"configurations\\": {
          \\"test\\": {
            \\"appLocation\\": \\"/foobar\\",
            \\"outputLocation\\": \\"/foobar\\",
            \\"appBuildCommand\\": \\"npm run build --if-present\\",
            \\"apiBuildCommand\\": \\"npm run build --if-present\\",
            \\"start\\": {
              \\"context\\": \\"/foobar\\"
            },
            \\"deploy\\": {
              \\"context\\": \\"/foobar\\"
            }
          }
        }
      }"
    `);
  });

  it("should never prompt the user when using --yes", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");

    await init(undefined, { ...defaultCliConfig, yes: true });
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it("should ask project name if it's not specified as an argument", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init(undefined, { ...defaultCliConfig });
    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    // check that the first prompt ask for projectName property
    expect(promptsMock.mock.calls[0][0].name).toEqual("projectName");
    expect(configJson.configurations["test-project"]).toBeDefined();
  });

  it("should not ask project name if it's not specified as an argument", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init("my-app", { ...defaultCliConfig });
    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    // check that the first prompt ask for projectName property
    expect(promptsMock.mock.calls[0][0].name).not.toEqual("projectName");
    expect(configJson.configurations["my-app"]).toBeDefined();
  });

  it("should ask for overwrite if a config already exists and abort", async () => {
    mockFs();
    const promptsMock: jest.Mock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue({ ...defautResolvedPrompts, confirmOverwrite: false });

    await init("test", { ...defaultCliConfig, yes: true });
    await init("test", { ...defaultCliConfig });

    // check that the first prompt ask for projectName property
    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));
    const lastCall = promptsMock.mock.calls.length - 1;
    expect(promptsMock.mock.calls[lastCall][0].name).toEqual("confirmOverwrite");
    expect(configJson.configurations.test.outputLocation).toEqual("/foobar");
  });

  it("should ask for overwrite if a config already exists and overwrite it", async () => {
    mockFs();
    const promptsMock: jest.Mock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init("test", { ...defaultCliConfig, yes: true });
    await init("test", { ...defaultCliConfig });

    // check that the first prompt ask for projectName property
    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));
    const lastCall = promptsMock.mock.calls.length - 1;
    expect(promptsMock.mock.calls[lastCall][0].name).toEqual("confirmOverwrite");
    expect(configJson.configurations.test.outputLocation).toEqual("./dist");
  });
});
