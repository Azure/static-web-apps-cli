import fs from "fs";
import mockFs from "mock-fs";
import { init } from "./init";
import { DEFAULT_CONFIG } from "../../config";
import { swaCliConfigFilename } from "../../core/utils";

jest.mock("prompts", () => jest.fn());

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
            \\"appLocation\\": \\"./\\",
            \\"outputLocation\\": \\"./\\",
            \\"start\\": {
              \\"context\\": \\"./\\"
            },
            \\"deploy\\": {
              \\"context\\": \\"./\\"
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

  it("should ask config name if it's not specified as an argument", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init(undefined, { ...defaultCliConfig });

    // check that the first prompt ask for configName property
    expect(promptsMock.mock.calls[0][0].name).toEqual("configName");
  });

  it("should not ask config name if it's not specified as an argument", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init("my-app", { ...defaultCliConfig });
    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    // check that the first prompt ask for configName property
    expect(promptsMock.mock.calls[0][0].name).not.toEqual("configName");
    expect(configJson.configurations["my-app"]).toBeDefined();
  });

  it("should ask for overwrite if a config already exists and abort", async () => {
    mockFs();
    const promptsMock: jest.Mock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue({ ...defautResolvedPrompts, confirmOverwrite: false });

    await init("test", { ...defaultCliConfig, yes: true });
    await init("test", { ...defaultCliConfig });

    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));
    const lastCall = promptsMock.mock.calls.length - 1;
    expect(promptsMock.mock.calls[lastCall][0].name).toEqual("confirmOverwrite");
    expect(configJson.configurations.test.outputLocation).toEqual("./");
  });

  it("should ask for overwrite if a config already exists and overwrite it", async () => {
    mockFs();
    const promptsMock: jest.Mock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init("test", { ...defaultCliConfig, yes: true });
    await init("test", { ...defaultCliConfig });

    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));
    const lastCall = promptsMock.mock.calls.length - 1;
    expect(promptsMock.mock.calls[lastCall][0].name).toEqual("confirmOverwrite");
    expect(configJson.configurations.test.outputLocation).toEqual("./dist");
  });

  it("should detect frameworks and create a config file", async () => {
    mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });

    await init("test", { ...defaultCliConfig, yes: true });
    const configFile = fs.readFileSync(defaultCliConfig.config, "utf-8");

    expect(configFile).toMatchInlineSnapshot(`
      "{
        \\"$schema\\": \\"https://aka.ms/azure/static-web-apps-cli/schema\\",
        \\"configurations\\": {
          \\"test\\": {
            \\"appLocation\\": \\"src/\\",
            \\"apiLocation\\": \\"node-ts/dist\\",
            \\"outputLocation\\": \\"src/\\",
            \\"apiBuildCommand\\": \\"npm run build --if-present\\",
            \\"start\\": {
              \\"context\\": \\"src/\\"
            },
            \\"deploy\\": {
              \\"context\\": \\"src/\\"
            }
          }
        }
      }"
    `);
  });
});
