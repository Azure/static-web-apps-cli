import mockFs from "mock-fs";
import * as path from "path";
import { DEFAULT_CONFIG } from "../../config";
import * as cliConfigModule from "./cli-config";
import { getConfigFileOptions, updateSwaCliConfigFile } from "./cli-config";

const mockConfig1 = {
  $schema: "../../../schema/swa-cli.config.schema.json",
  configurations: {
    app: {
      outputLocation: "./cypress/fixtures/static",
      apiLocation: "./cypress/fixtures/api",
      port: 1111,
      devServerTimeout: 10000,
      verbose: "silly",
    },
    app2: {
      outputLocation: "./cypress/fixtures/static",
      apiLocation: "./cypress/fixtures/api",
      port: 2222,
      devServerTimeout: 10000,
      verbose: "silly",
    },
  },
};

const mockConfig2 = {
  $schema: "../../../schema/swa-cli.config.schema.json",
  configurations: {
    app: {
      outputLocation: "./cypress/fixtures/static",
      apiLocation: "./cypress/fixtures/api",
      port: 3333,
      devServerTimeout: 10000,
      verbose: "silly",
    },
  },
};

const mockConfig = (config: any = mockConfig1) => {
  mockFs({
    "swa-cli.config.json": JSON.stringify(config),
  });
};

describe("getConfigFileOptions()", () => {
  afterEach(() => {
    mockFs.restore();
  });

  mockFs({
    "swa-cli.config.json": ``,
  });

  it("Should return empty object if not found", async () => {
    mockConfig();
    expect(await getConfigFileOptions("app", "")).toStrictEqual({});
  });

  it("Should return empty object if contex is undefined", async () => {
    mockConfig();
    expect(await getConfigFileOptions(undefined, "")).toStrictEqual({});
  });

  it("Should return empty object if config name is not found", async () => {
    mockConfig();
    expect(await getConfigFileOptions("configName", "swa-cli.config.json")).toStrictEqual({});
  });

  it("Should return proper config options", async () => {
    mockConfig();
    expect(await getConfigFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
  });

  it("Should return the default config if there are one or more configs", async () => {
    mockConfig();
    expect(await getConfigFileOptions(DEFAULT_CONFIG.appLocation, "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
  });

  it("Should return a default config", async () => {
    mockConfig(mockConfig2);
    expect(await getConfigFileOptions(DEFAULT_CONFIG.appLocation, "swa-cli.config.json")).toStrictEqual(mockConfig2.configurations.app);
  });

  it("Should return empty object if config file is not found", async () => {
    expect(await getConfigFileOptions(DEFAULT_CONFIG.appLocation, "swa-cli.config.json")).toStrictEqual({});
  });

  it("Should return proper config without path specified", async () => {
    mockConfig(mockConfig1);
    expect(await getConfigFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
  });

  it("Should change cwd to the config root dir if a config exists", async () => {
    const configDir = path.resolve("../../");
    mockFs({ "../../swa-cli.config.json": JSON.stringify(mockConfig1) });
    expect(await getConfigFileOptions("app", "../../swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    expect(process.cwd()).toBe(configDir);
  });

  it("Should not change cwd no config is specified or found", async () => {
    const currentDir = path.resolve(".");
    mockFs({ "../../swa-cli.config.json": JSON.stringify(mockConfig1) });
    expect(await getConfigFileOptions("app", "swa-cli.config.json")).toEqual({});
    expect(process.cwd()).toBe(currentDir);
  });
});

describe("updateSwaCliConfigFile()", () => {
  afterAll(() => {
    mockFs.restore();
  });

  it("Should update the config file", async () => {
    const config: SWACLIConfig = {
      outputLocation: "./",
      apiLocation: "./",
    };

    jest.spyOn(global.console, "error");
    const spyGetCurrentSwaCliConfigFromFile = jest.spyOn(cliConfigModule, "getCurrentSwaCliConfigFromFile").mockReturnValue(undefined);
    const spyWriteConfigFile = jest.spyOn(cliConfigModule, "writeConfigFile");
    const spyProcessExit = jest.spyOn(process, "exit").mockImplementation();

    mockConfig({
      configurations: {
        app: {
          outputLocation: "./",
        },
      },
    });

    // await updateSwaCliConfigFile(config);

    expect(spyGetCurrentSwaCliConfigFromFile).toHaveBeenCalled();
    expect(spyProcessExit).toHaveBeenCalled();
    expect(spyWriteConfigFile).not.toHaveBeenCalled();
  });
});
