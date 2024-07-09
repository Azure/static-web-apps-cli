import "../../../../tests/_mocks/fs.js";
import { fs, vol } from "memfs";
import { init } from "./init.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { swaCliConfigFilename } from "../../../core/utils/cli-config.js";
import { convertToNativePaths } from "../../../test.helpers.js";

const promptsMock = vi.fn();
vi.mock("prompts", () => promptsMock);

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
  apiDevserverUrl: "http://localhost:4040",
  confirmOverwrite: true,
};

describe("swa init", () => {
  beforeEach(() => {
    vol.reset();
  });

  it("should create a config file", async () => {
    await init({ ...defaultCliConfig, configName: "test", yes: true });
    const configFile = fs.readFileSync(defaultCliConfig.config, "utf-8");

    expect(configFile).toMatchInlineSnapshot(`
      "{
        "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
        "configurations": {
          "test": {
            "appLocation": ".",
            "outputLocation": "."
          }
        }
      }"
    `);
  });

  it("should never prompt the user when using --yes", async () => {
    await init({ ...defaultCliConfig, yes: true });
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it("should ask config name if it's not specified as an argument", async () => {
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig });

    // check that the first prompt ask for configName property
    expect(promptsMock).toHaveBeenCalledWith({ name: "configName" });
  });

  it("should not ask config name if it's not specified as an argument", async () => {
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig, configName: "my-app" });
    const configFileContents = fs.readFileSync(defaultCliConfig.config, "utf-8");
    const configJson = JSON.parse("" + configFileContents);

    // check that the first prompt ask for configName property
    expect(promptsMock).toHaveBeenCalledWith({ name: "configName" });
    expect(configJson.configurations["my-app"]).toBeDefined();
  });

  it("should ask for overwrite if a config already exists and abort", async () => {
    promptsMock.mockResolvedValue({ ...defautResolvedPrompts, confirmOverwrite: false });

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    await init({ ...defaultCliConfig, configName: "test" });

    const configFileContents = fs.readFileSync(defaultCliConfig.config, "utf-8");
    const configJson = JSON.parse("" + configFileContents);
    expect(promptsMock).toHaveBeenLastCalledWith({ name: "confirmOverwrite" });
    expect(configJson.configurations.test.outputLocation).toEqual(".");
  });

  it("should ask for overwrite if a config already exists and overwrite it", async () => {
    promptsMock.mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    await init({ ...defaultCliConfig, configName: "test" });

    const configFileContents = fs.readFileSync(defaultCliConfig.config, "utf-8");
    const configJson = JSON.parse("" + configFileContents);
    expect(promptsMock).toHaveBeenLastCalledWith({ name: "confirmOverwrite" });
    expect(configJson.configurations.test.outputLocation).toEqual(convertToNativePaths("./dist"));
  });

  // JEST-TODO: mockFs.load
  // it("should detect frameworks and create a config file", async () => {
  //   mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });

  //   await init({ ...defaultCliConfig, configName: "test", yes: true });
  //   const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

  //   expect(configFile).toMatchInlineSnapshot(`
  //     "{
  //       "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  //       "configurations": {
  //         "test": {
  //           "appLocation": "src",
  //           "apiLocation": "src/node-ts",
  //           "outputLocation": ".",
  //           "apiLanguage": "node",
  //           "apiVersion": "16",
  //           "apiBuildCommand": "npm run build --if-present"
  //         }
  //       }
  //     }"
  //   `);
  // });

  // JEST-TODO: mockFs.load
  // it("should detect frameworks and create a config file including a dev server", async () => {
  //   mockFs({ src: mockFs.load("e2e/fixtures/astro-node") });

  //   await init({ ...defaultCliConfig, configName: "test", yes: true });
  //   const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

  //   expect(configFile).toMatchInlineSnapshot(`
  //     "{
  //       "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  //       "configurations": {
  //         "test": {
  //           "appLocation": "src/astro preact",
  //           "apiLocation": "src/node",
  //           "outputLocation": "_site",
  //           "apiLanguage": "node",
  //           "apiVersion": "16",
  //           "appBuildCommand": "npm run build",
  //           "apiBuildCommand": "npm run build --if-present",
  //           "run": "npm run dev",
  //           "appDevserverUrl": "http://localhost:8080"
  //         }
  //       }
  //     }"
  //   `);
  // });

  // JEST-TODO: mockFs.load
  // it("should detect frameworks and let user override config options", async () => {
  //   mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });
  //   promptsMock.mockResolvedValue({
  //     ...defautResolvedPrompts,
  //     confirmSettings: false,
  //   });

  //   await init({ ...defaultCliConfig, configName: "test" });
  //   const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

  //   expect(configFile).toMatchInlineSnapshot(`
  //     "{
  //       "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  //       "configurations": {
  //         "test": {
  //           "appLocation": "./app",
  //           "apiLocation": "./api",
  //           "outputLocation": "./dist",
  //           "appBuildCommand": "npm run build",
  //           "apiBuildCommand": "npm run build:api",
  //           "run": "npm run dev",
  //           "appDevserverUrl": "http://localhost:3000",
  //           "apiDevserverUrl": "http://localhost:4040"
  //         }
  //       }
  //     }"
  //   `);
  // });
});
