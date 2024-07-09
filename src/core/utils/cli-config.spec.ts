import "../../../tests/_mocks/fs.js";
import { fs, vol } from "memfs";
import { logger } from "./logger.js";
import * as cliConfigModule from "./cli-config.js";
import { getConfigFileOptions, updateSwaCliConfigFile, writeConfigFile } from "./cli-config.js";

vi.mock("./logger", () => {
  return {
    logger: {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      silly: vi.fn(),
    },
    logGitHubIssueMessageAndExit: vi.fn(),
  };
});

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

describe("CLI config", () => {
  describe("getConfigFileOptions()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("Should return empty object if not found", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await getConfigFileOptions("app", "")).toStrictEqual({});
    });

    it("Should return empty object if contex is undefined", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await getConfigFileOptions(undefined, "")).toStrictEqual({});
    });

    it("Should return empty object if config name is not found", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await getConfigFileOptions("configName", "swa-cli.config.json")).toStrictEqual({});
    });

    it("Should return proper config options", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await getConfigFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    });

    it("Should return the default config if there are one or more configs", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    });

    it("Should return a default config", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig2),
      });
      expect(await getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual(mockConfig2.configurations.app);
    });

    it("Should return empty object if config file is not found", async () => {
      expect(await getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual({});
    });

    it("Should return proper config without path specified", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await getConfigFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    });

    // it("Should change cwd to the config root dir if a config exists", async () => {
    //   const configDir = path.resolve("../../");
    //   vol.fromJSON({
    //     "../../swa-cli.config.json": JSON.stringify(mockConfig1)
    //   });
    //   expect(await getConfigFileOptions("app", "../../swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    //   expect(process.cwd()).toBe(configDir);
    // });

    // it("Should not change cwd no config is specified or found", async () => {
    //   const currentDir = path.resolve(".");
    //   vol.fromJSON({ "../../swa-cli.config.json": JSON.stringify(mockConfig1) });
    //   expect(await getConfigFileOptions("app", "swa-cli.config.json")).toEqual({});
    //   expect(process.cwd()).toBe(currentDir);
    // });
  });

  describe("updateSwaCliConfigFile", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("Should fail and exit when currentSwaCliConfigFromFile is undefined", async () => {
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      // set currentSwaCliConfigFromFile to undefined
      const spyGetCurrentSwaCliConfigFromFile = vi.spyOn(cliConfigModule, "getCurrentSwaCliConfigFromFile").mockReturnValue(undefined);
      const spyWriteFile = vi.spyOn(fs, "writeFile");

      const storedConfig = {
        configurations: {
          app: {
            outputLocation: "./",
          },
        },
      };
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(storedConfig),
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
      const spyGetCurrentSwaCliConfigFromFile = vi.spyOn(cliConfigModule, "getCurrentSwaCliConfigFromFile").mockReturnValue({ name: "app" } as any);
      const spyWriteFile = vi.spyOn(fs, "writeFile");
      // const spyProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {});

      const mockConfig = {
        configurations: {
          app: {},
        },
      };
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig),
      });

      await updateSwaCliConfigFile(config);

      expect(spyGetCurrentSwaCliConfigFromFile).toHaveBeenCalled();
      expect(spyWriteFile).toHaveBeenCalled();
      //expect(spyProcessExit).not.toHaveBeenCalled();
    });
  });

  describe("writeConfigFile()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("Should write new config into file", async () => {
      const spySwaCliConfigFileExists = vi.spyOn(cliConfigModule, "swaCliConfigFileExists");
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      const mockConfig = {
        configurations: {
          app: {},
        },
      };
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig),
      });
      const spyWriteFile = vi.spyOn(fs, "writeFile");

      await writeConfigFile("swa-cli.config.json", "foo", config);
      const savedFileContent = fs.readFileSync("swa-cli.config.json", "utf8");

      expect(spyWriteFile).toHaveBeenCalled();
      expect(spySwaCliConfigFileExists).toHaveBeenCalled();
      expect(JSON.parse("" + savedFileContent).configurations.foo).toStrictEqual(config);
    });

    it("Should override existing config into file", async () => {
      const spySwaCliConfigFileExists = vi.spyOn(cliConfigModule, "swaCliConfigFileExists");
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      const mockConfig = {
        configurations: {
          app: {},
        },
      };
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig),
      });
      const spyWriteFile = vi.spyOn(fs, "writeFile");

      await writeConfigFile("swa-cli.config.json", "app", config);
      const savedFileContent = fs.readFileSync("swa-cli.config.json", "utf8");

      expect(spyWriteFile).toHaveBeenCalled();
      expect(spySwaCliConfigFileExists).toHaveBeenCalled();
      expect(JSON.parse("" + savedFileContent).configurations.app).toStrictEqual(config);
    });

    it("Should add an configuration entry if it does not exist", async () => {
      const spySwaCliConfigFileExists = vi.spyOn(cliConfigModule, "swaCliConfigFileExists");
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      vol.fromJSON({
        "swa-cli.config.json": "{}",
      });
      const spyWriteFile = vi.spyOn(fs, "writeFile");

      await writeConfigFile("swa-cli.config.json", "app", config);
      const savedFileContent = fs.readFileSync("swa-cli.config.json", "utf8");

      expect(spyWriteFile).toHaveBeenCalled();
      expect(spySwaCliConfigFileExists).toHaveBeenCalled();
      expect(JSON.parse("" + savedFileContent).configurations.app).toStrictEqual(config);
    });

    it("Should error if config file is malformed", async () => {
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      vol.fromJSON({
        "swa-cli.config.json": '""',
      });

      await writeConfigFile("swa-cli.config.json", "app", config);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
