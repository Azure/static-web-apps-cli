import mockFs from "mock-fs";
// Spy on console to avoid this error: https://github.com/tschaub/mock-fs/issues/234
jest.spyOn(global.console, "log").mockImplementation();
jest.spyOn(global.console, "warn").mockImplementation();
jest.spyOn(global.console, "error").mockImplementation();

jest.mock("../../core/utils/logger", () => {
  return {
    logger: {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      silly: jest.fn(),
    },
    logGiHubIssueMessageAndExit: jest.fn(),
  };
});

import * as fsModule from "fs";
const spyWriteFile = jest.spyOn(fsModule.promises, "writeFile");

import * as path from "path";
import { logger } from "../../core";
import * as cliConfigModule from "./cli-config";
import { getConfigFileOptions, updateSwaCliConfigFile, writeConfigFile } from "./cli-config";

const mockConfig1 = {
  $schema: "../../../schema/swa-cli.config.schema.json",
  configurations: {
    app: {
      outputLocation: "./cypress/fixtures/static",
      apiLocation: "./cypress/fixtures/api",
      port: 1111,
      devserverTimeout: 10,
      verbose: "silly",
    },
    app2: {
      outputLocation: "./cypress/fixtures/static",
      apiLocation: "./cypress/fixtures/api",
      port: 2222,
      devserverTimeout: 10,
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
      devserverTimeout: 10,
      verbose: "silly",
    },
  },
};

const mockConfig = (config: any = mockConfig1) => {
  mockFs({
    "swa-cli.config.json": JSON.stringify(config),
  });
};

describe("CLI config", () => {
  describe("getConfigFileOptions()", () => {
    afterEach(() => {
      mockFs.restore();
    });

    beforeEach(() => {
      mockFs({
        "swa-cli.config.json": ``,
      });
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
      expect(await getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    });

    it("Should return a default config", async () => {
      mockConfig(mockConfig2);
      expect(await getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual(mockConfig2.configurations.app);
    });

    it("Should return empty object if config file is not found", async () => {
      expect(await getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual({});
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

  describe("updateSwaCliConfigFile", () => {
    afterEach(() => {
      mockFs.restore();
    });

    beforeEach(() => {
      spyWriteFile.mockClear();
      mockFs({
        "swa-cli.config.json": ``,
      });
    });

    it("Should fail and exit when currentSwaCliConfigFromFile is undefined", async () => {
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      // set currentSwaCliConfigFromFile to undefined
      const spyGetCurrentSwaCliConfigFromFile = jest.spyOn(cliConfigModule, "getCurrentSwaCliConfigFromFile").mockReturnValue(undefined);

      mockConfig({
        configurations: {
          app: {
            outputLocation: "./",
          },
        },
      });

      await updateSwaCliConfigFile(config);

      // we should not write to config file
      expect(spyWriteFile).not.toHaveBeenCalled();

      expect(spyGetCurrentSwaCliConfigFromFile).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith("No configuration file currently loaded", true);
    });

    it("Should update config file when currentSwaCliConfigFromFile is set", async () => {
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      // set currentSwaCliConfigFromFile to undefined
      const spyGetCurrentSwaCliConfigFromFile = jest.spyOn(cliConfigModule, "getCurrentSwaCliConfigFromFile").mockReturnValue({ name: "app" } as any);
      const spyProcessExit = jest.spyOn(process, "exit").mockImplementation();

      mockConfig({
        configurations: {
          app: {},
        },
      });

      await updateSwaCliConfigFile(config);

      expect(spyGetCurrentSwaCliConfigFromFile).toHaveBeenCalled();
      expect(spyWriteFile).toHaveBeenCalled();
      expect(spyProcessExit).not.toHaveBeenCalled();
    });
  });

  describe("writeConfigFile()", () => {
    afterEach(() => {
      mockFs.restore();
    });

    beforeEach(() => {
      spyWriteFile.mockClear();
      mockFs({
        "swa-cli.config.json": ``,
      });
    });

    it("Should write new config into file", async () => {
      const spySwaCliConfigFileExists = jest.spyOn(cliConfigModule, "swaCliConfigFileExists");
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      mockConfig({
        configurations: {
          app: {},
        },
      });

      await writeConfigFile("swa-cli.config.json", "foo", config);
      const savedFileConten = fsModule.readFileSync("swa-cli.config.json", "utf8");

      expect(spyWriteFile).toHaveBeenCalled();
      expect(spySwaCliConfigFileExists).toHaveBeenCalled();
      expect(JSON.parse(savedFileConten).configurations.foo).toStrictEqual(config);
    });

    it("Should override existing config into file", async () => {
      const spySwaCliConfigFileExists = jest.spyOn(cliConfigModule, "swaCliConfigFileExists");
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      mockConfig({
        configurations: {
          app: {},
        },
      });

      await writeConfigFile("swa-cli.config.json", "app", config);
      const savedFileConten = fsModule.readFileSync("swa-cli.config.json", "utf8");

      expect(spyWriteFile).toHaveBeenCalled();
      expect(spySwaCliConfigFileExists).toHaveBeenCalled();
      expect(JSON.parse(savedFileConten).configurations.app).toStrictEqual(config);
    });

    it("Should add an configuration entry if it does not exist", async () => {
      const spySwaCliConfigFileExists = jest.spyOn(cliConfigModule, "swaCliConfigFileExists");
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      mockConfig({});

      await writeConfigFile("swa-cli.config.json", "app", config);
      const savedFileConten = fsModule.readFileSync("swa-cli.config.json", "utf8");

      expect(spyWriteFile).toHaveBeenCalled();
      expect(spySwaCliConfigFileExists).toHaveBeenCalled();
      expect(JSON.parse(savedFileConten).configurations.app).toStrictEqual(config);
    });

    it("Should error if config file is malformed", async () => {
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      mockConfig(""); // pass invalid config

      await writeConfigFile("swa-cli.config.json", "app", config);

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
