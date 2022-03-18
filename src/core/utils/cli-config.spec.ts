import * as path from "path";
import mockFs from "mock-fs";
import { defaultStartContext } from "../../cli";

import { getFileOptions } from "./cli-config";

const mockConfig1 = {
  $schema: "../../../schema/swa-cli.config.schema.json",
  configurations: {
    app: {
      context: "./cypress/fixtures/static",
      apiLocation: "./cypress/fixtures/api",
      port: 1111,
      devServerTimeout: 10000,
      verbose: "silly",
    },
    app2: {
      context: "./cypress/fixtures/static",
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
      context: "./cypress/fixtures/static",
      apiLocation: "./cypress/fixtures/api",
      port: 3333,
      devServerTimeout: 10000,
      verbose: "silly",
    },
  },
};

describe("getFileOptions()", () => {
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
    expect(await getFileOptions("app", "")).toStrictEqual({});
  });

  it("Should return empty object if config name is not found", async () => {
    mockConfig();
    expect(await getFileOptions("configName", "swa-cli.config.json")).toStrictEqual({});
  });

  it("Should return proper config options", async () => {
    mockConfig();
    expect(await getFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
  });

  it("Should only return a default config if there is only one config", async () => {
    mockConfig();
    expect(await getFileOptions(defaultStartContext, "swa-cli.config.json")).toStrictEqual({});
  });

  it("Should return a default config", async () => {
    mockConfig(mockConfig2);
    expect(await getFileOptions(defaultStartContext, "swa-cli.config.json")).toStrictEqual(mockConfig2.configurations.app);
  });

  it("Should return empty object if config file is not found", async () => {
    expect(await getFileOptions(defaultStartContext, "swa-cli.config.json")).toStrictEqual({});
  });

  it("Should return proper config without path specified", async () => {
    mockConfig(mockConfig1);
    expect(await getFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
  });

  it("Should change cwd to the config root dir if a config exists", async () => {
    const configDir = path.resolve("../../");
    mockFs({ "../../swa-cli.config.json": JSON.stringify(mockConfig1) });
    expect(await getFileOptions("app", "../../swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    expect(process.cwd()).toBe(configDir);
  });

  it("Should not change cwd no config is specified or found", async () => {
    const currentDir = path.resolve(".");
    mockFs({ "../../swa-cli.config.json": JSON.stringify(mockConfig1) });
    expect(await getFileOptions("app", "swa-cli.config.json")).toEqual({});
    expect(process.cwd()).toBe(currentDir);
  });
});
