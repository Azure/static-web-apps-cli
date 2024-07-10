import "../../../../tests/_mocks/fs.js";
import { fs, vol } from "memfs";
import { init } from "./init.js";
import prompts from "prompts";
import { DEFAULT_CONFIG } from "../../../config.js";
import { swaCliConfigFilename } from "../../../core/utils/cli-config.js";
import { convertToUnixPaths, convertToNativePaths } from "../../../test.helpers.js";

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

vi.mock("prompts", () => {
  return {
    default: vi.fn(),
  };
});

describe("swa init", () => {
  beforeEach(() => {
    vol.reset();
    vol.fromNestedJSON({
      "/home/user": {},
    });
    vi.spyOn(process, "cwd").mockReturnValue("/home/user");
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
    expect(prompts).not.toHaveBeenCalled();
  });

  // SKIPPED: Cannot mock prompts
  it.skip("should ask config name if it's not specified as an argument", async () => {
    vi.mocked(prompts).mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig });

    // check that the first prompt ask for configName property
    expect(prompts).toHaveBeenCalledWith({ name: "configName" });
  });

  // SKIPPED: Cannot mock prompts
  it.skip("should not ask config name if it's not specified as an argument", async () => {
    vi.mocked(prompts).mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig, configName: "my-app" });
    const configFileContents = fs.readFileSync(defaultCliConfig.config, "utf-8");
    const configJson = JSON.parse("" + configFileContents);

    // check that the first prompt ask for configName property
    expect(prompts).toHaveBeenCalledWith({ name: "configName" });
    expect(configJson.configurations["my-app"]).toBeDefined();
  });

  // SKIPPED: cannot mock prompts
  it.skip("should ask for overwrite if a config already exists and abort", async () => {
    vi.mocked(prompts).mockResolvedValue({ ...defautResolvedPrompts, confirmOverwrite: false });

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    await init({ ...defaultCliConfig, configName: "test" });

    const configFileContents = fs.readFileSync(defaultCliConfig.config, "utf-8");
    const configJson = JSON.parse("" + configFileContents);
    expect(prompts).toHaveBeenLastCalledWith({ name: "confirmOverwrite" });
    expect(configJson.configurations.test.outputLocation).toEqual(".");
  });

  // SKIPPED: cannot mock prompts
  it.skip("should ask for overwrite if a config already exists and overwrite it", async () => {
    vi.mocked(prompts).mockResolvedValue(defautResolvedPrompts);

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    await init({ ...defaultCliConfig, configName: "test" });

    const configFileContents = fs.readFileSync(defaultCliConfig.config, "utf-8");
    const configJson = JSON.parse("" + configFileContents);
    expect(prompts).toHaveBeenLastCalledWith({ name: "confirmOverwrite" });
    expect(configJson.configurations.test.outputLocation).toEqual(convertToNativePaths("./dist"));
  });

  // SKIPPED: need to use unionfs for this one.
  it.skip("should detect frameworks and create a config file", async () => {
    //mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    expect(configFile).toMatchInlineSnapshot(`
      "{
        "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
        "configurations": {
          "test": {
            "appLocation": "src",
            "apiLocation": "src/node-ts",
            "outputLocation": ".",
            "apiLanguage": "node",
            "apiVersion": "16",
            "apiBuildCommand": "npm run build --if-present"
          }
        }
      }"
    `);
  });

  // SKIPPED: need to use unionfs for this one.
  it.skip("should detect frameworks and create a config file including a dev server", async () => {
    //mockFs({ src: mockFs.load("e2e/fixtures/astro-node") });

    await init({ ...defaultCliConfig, configName: "test", yes: true });
    const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    expect(configFile).toMatchInlineSnapshot(`
      "{
        "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
        "configurations": {
          "test": {
            "appLocation": "src/astro preact",
            "apiLocation": "src/node",
            "outputLocation": "_site",
            "apiLanguage": "node",
            "apiVersion": "16",
            "appBuildCommand": "npm run build",
            "apiBuildCommand": "npm run build --if-present",
            "run": "npm run dev",
            "appDevserverUrl": "http://localhost:8080"
          }
        }
      }"
    `);
  });

  // SKIPPED: need to use unionfs for this one.
  it.skip("should detect frameworks and let user override config options", async () => {
    //mockFs({ src: mockFs.load("e2e/fixtures/static-node-ts") });
    vi.mocked(prompts).mockResolvedValue({ ...defautResolvedPrompts, confirmSettings: false });

    await init({ ...defaultCliConfig, configName: "test" });
    const configFile = convertToUnixPaths(fs.readFileSync(defaultCliConfig.config, "utf-8"));

    expect(configFile).toMatchInlineSnapshot(`
      "{
        "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
        "configurations": {
          "test": {
            "appLocation": "./app",
            "apiLocation": "./api",
            "outputLocation": "./dist",
            "appBuildCommand": "npm run build",
            "apiBuildCommand": "npm run build:api",
            "run": "npm run dev",
            "appDevserverUrl": "http://localhost:3000",
            "apiDevserverUrl": "http://localhost:4040"
          }
        }
      }"
    `);
  });
});
