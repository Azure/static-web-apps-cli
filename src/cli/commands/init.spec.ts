import fs from "fs";
import mockFs from "mock-fs";
import { init } from "./init";
import { DEFAULT_CONFIG } from "../../config";
import { swaCliConfigFilename } from "../../core/utils";
import { convertToNativePaths, convertToUnixPaths } from "../../jest.helpers.";

jest.mock("prompts", () => jest.fn());

const defaultCliConfig = {
  ...DEFAULT_CONFIG,
  config: swaCliConfigFilename,
};

const defautResolvedPrompts = {
  projectName: "test-project",
  appLocation: convertToNativePaths("./app"),
  apiLocation: convertToNativePaths("./api"),
  outputLocation: convertToNativePaths("./dist"),
  appBuildCommand: "npm run build",
  apiBuildCommand: "npm run build:api",
  appDevserverCommand: "npm run dev",
  appDevserverUrl: "http://localhost:3000",
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

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    const configFile = fs.readFileSync(defaultCliConfig.config, "utf-8");

    expect(configFile).toMatchInlineSnapshot(`
      "{
        \\"$schema\\": \\"https://aka.ms/azure/static-web-apps-cli/schema\\",
        \\"configurations\\": {
          \\"test\\": {
            \\"appLocation\\": \\".\\",
            \\"outputLocation\\": \\".\\"
          }
        }
      }"
    `);
  });

  it("should never prompt the user when using --yes", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");

    await init({ ...defaultCliConfig, yes: true });
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it("should ask config name if it's not specified as an argument", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig });

    // check that the first prompt ask for configName property
    expect(promptsMock.mock.calls[0][0].name).toEqual("configName");
  });

  it("should not ask config name if it's not specified as an argument", async () => {
    mockFs();
    const promptsMock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig, configName: "my-app" });
    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    // check that the first prompt ask for configName property
    expect(promptsMock.mock.calls[0][0].name).not.toEqual("configName");
    expect(configJson.configurations["my-app"]).toBeDefined();
  });

  it("should ask for overwrite if a config already exists and abort", async () => {
    mockFs();
    const promptsMock: jest.Mock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue({ ...defautResolvedPrompts, confirmOverwrite: false });

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    await init({ ...defaultCliConfig, configName: "test" });

    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));
    const lastCall = promptsMock.mock.calls.length - 1;
    expect(promptsMock.mock.calls[lastCall][0].name).toEqual("confirmOverwrite");
    expect(configJson.configurations.test.outputLocation).toEqual(".");
  });

  it("should ask for overwrite if a config already exists and overwrite it", async () => {
    mockFs();
    const promptsMock: jest.Mock = jest.requireMock("prompts");
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    await init({ ...defaultCliConfig, configName: "test" });

    const configJson = JSON.parse(fs.readFileSync(defaultCliConfig.config, "utf-8"));
    const lastCall = promptsMock.mock.calls.length - 1;
    expect(promptsMock.mock.calls[lastCall][0].name).toEqual("confirmOverwrite");
    expect(configJson.configurations.test.outputLocation).toEqual(convertToNativePaths("./dist"));
  });

  it("should detect frameworks and create a config file", async () => {
    mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    expect(configFile).toMatchInlineSnapshot(`
      "{
        \\"$schema\\": \\"https://aka.ms/azure/static-web-apps-cli/schema\\",
        \\"configurations\\": {
          \\"test\\": {
            \\"appLocation\\": \\"src\\",
            \\"apiLocation\\": \\"src/node-ts\\",
            \\"outputLocation\\": \\".\\",
            \\"apiBuildCommand\\": \\"npm run build --if-present\\"
          }
        }
      }"
    `);
  });

  it("should detect frameworks and create a config file including a dev server", async () => {
    mockFs({ src: mockFs.load("e2e/fixtures/astro-node") });

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    expect(configFile).toMatchInlineSnapshot(`
      "{
        \\"$schema\\": \\"https://aka.ms/azure/static-web-apps-cli/schema\\",
        \\"configurations\\": {
          \\"test\\": {
            \\"appLocation\\": \\"src/astro preact\\",
            \\"apiLocation\\": \\"src/node\\",
            \\"outputLocation\\": \\"_site\\",
            \\"appBuildCommand\\": \\"npm run build\\",
            \\"apiBuildCommand\\": \\"npm run build --if-present\\",
            \\"run\\": \\"npm run dev\\",
            \\"appDevserverUrl\\": \\"http://localhost:8080\\"
          }
        }
      }"
    `);
  });
});
