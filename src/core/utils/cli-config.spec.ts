import * as path from "path";
import mockFs from "mock-fs";

import { getConfigFileOptions } from "./cli-config";
import { DEFAULT_CONFIG } from "../../config";

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

describe("getConfigFileOptions()", () => {
  afterEach(() => {
    mockFs.restore();
  });

  const mockConfig = (config: any = mockConfig1) => {
    mockFs({
      "swa-cli.config.json": JSON.stringify(config),
    });
  };

  mockFs({
    "swa-cli.config.json": ``,
  });

  it("Should return empty object if not found", async () => {
    mockConfig();
    expect(await getConfigFileOptions("app", "")).toStrictEqual({});
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
