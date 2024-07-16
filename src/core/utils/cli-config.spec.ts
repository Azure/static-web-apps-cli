import "../../../tests/_mocks/fs.js";
import { fs, vol } from "memfs";
import { logger } from "./logger.js";
import * as cliConfigModule from "./cli-config.js";

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

// An easy "sleep" method since some tests require us to be 1ms offset to
// have a meaningful result.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("CLI config", () => {
  describe("getConfigFileOptions()", () => {
    let originalSwaConfig: SWACLIConfigInfo | undefined;

    beforeEach(() => {
      vol.reset();
      originalSwaConfig = cliConfigModule.getCurrentSwaCliConfigFromFile();
    });

    afterEach(() => {
      cliConfigModule.setCurrentSwaCliConfigFromFile(originalSwaConfig);
    });

    it("Should return empty object if not found", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await cliConfigModule.getConfigFileOptions("app", "")).toStrictEqual({});
    });

    it("Should return empty object if contex is undefined", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await cliConfigModule.getConfigFileOptions(undefined, "")).toStrictEqual({});
    });

    it("Should return empty object if config name is not found", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await cliConfigModule.getConfigFileOptions("configName", "swa-cli.config.json")).toStrictEqual({});
    });

    it("Should return proper config options", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await cliConfigModule.getConfigFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    });

    it("Should return the default config if there are one or more configs", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await cliConfigModule.getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    });

    it("Should return a default config", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig2),
      });
      expect(await cliConfigModule.getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual(mockConfig2.configurations.app);
    });

    it("Should return empty object if config file is not found", async () => {
      expect(await cliConfigModule.getConfigFileOptions(undefined, "swa-cli.config.json")).toStrictEqual({});
    });

    it("Should return proper config without path specified", async () => {
      vol.fromJSON({
        "swa-cli.config.json": JSON.stringify(mockConfig1),
      });
      expect(await cliConfigModule.getConfigFileOptions("app", "swa-cli.config.json")).toStrictEqual(mockConfig1.configurations.app);
    });
  });

  describe("updateSwaCliConfigFile", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("Should fail and exit when currentSwaCliConfigFromFile is undefined", async () => {
      cliConfigModule.setCurrentSwaCliConfigFromFile(undefined);

      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

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

      const originalStats = await fs.promises.stat("swa-cli.config.json");
      await sleep(1);
      await cliConfigModule.updateSwaCliConfigFile(config);
      const updatedStats = await fs.promises.stat("swa-cli.config.json");
      expect(updatedStats.mtimeMs).toBe(originalStats.mtimeMs); // File has not been modified as a result of the call.
      expect(logger.error).toHaveBeenCalledWith("No configuration file currently loaded", true);
    });

    it("Should update config file when currentSwaCliConfigFromFile is set", async () => {
      cliConfigModule.setCurrentSwaCliConfigFromFile({ name: "app", filePath: "swa-cli.config.json", config: {} });

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

      const originalState = (await fs.promises.readFile("swa-cli.config.json")).toString();
      await sleep(1);
      await cliConfigModule.updateSwaCliConfigFile(config);
      const updatedState = (await fs.promises.readFile("swa-cli.config.json")).toString();
      expect(updatedState).not.toBe(originalState);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("writeConfigFile()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("Should write new config into file", async () => {
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

      await cliConfigModule.writeConfigFile("swa-cli.config.json", "foo", config);
      const savedFileContent = fs.readFileSync("swa-cli.config.json", "utf8");
      expect(JSON.parse("" + savedFileContent).configurations.foo).toStrictEqual(config);
    });

    it("Should override existing config into file", async () => {
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

      await cliConfigModule.writeConfigFile("swa-cli.config.json", "app", config);
      const savedFileContent = fs.readFileSync("swa-cli.config.json", "utf8");
      expect(JSON.parse("" + savedFileContent).configurations.app).toStrictEqual(config);
    });

    it("Should add an configuration entry if it does not exist", async () => {
      const config: SWACLIConfig = {
        outputLocation: "./",
        apiLocation: "./",
      };

      vol.fromJSON({
        "swa-cli.config.json": "{}",
      });

      await cliConfigModule.writeConfigFile("swa-cli.config.json", "app", config);
      const savedFileContent = fs.readFileSync("swa-cli.config.json", "utf8");
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

      await cliConfigModule.writeConfigFile("swa-cli.config.json", "app", config);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
