import { Command } from "commander";
import mockFs from "mock-fs";
import { swaCliConfigFilename } from "./cli-config";
import { parsePort } from "./net";
import { configureOptions, getUserOptions } from "./options";
import { DEFAULT_CONFIG } from "../../config";

describe("configureOptions()", () => {
  afterEach(() => {
    mockFs.restore();
  });

  it("should return configuration options", async () => {
    const command = await new Command().parseAsync([]);

    expect(await configureOptions("test", { config: swaCliConfigFilename, port: 1234 }, command, "init")).toStrictEqual({
      config: swaCliConfigFilename,
      port: 1234,
    });
  });

  it("should return merged configuration from config file", async () => {
    const command = await new Command().parseAsync([]);
    mockFs({
      "swa-cli.config.json": JSON.stringify({
        configurations: {
          test: { port: 1234 },
        },
      }),
    });

    expect(await configureOptions("test", { config: swaCliConfigFilename }, command, "init")).toStrictEqual({
      config: swaCliConfigFilename,
      port: 1234,
    });
  });

  it("should return merged configuration with config file overriding default cli options", async () => {
    const command = await new Command().option<number>("--port <port>", "", parsePort, 4444).parseAsync([]);

    mockFs({
      "swa-cli.config.json": JSON.stringify({
        configurations: {
          test: { port: 1234 },
        },
      }),
    });

    expect(await configureOptions("test", { config: swaCliConfigFilename, port: 4444 }, command, "init")).toStrictEqual({
      config: swaCliConfigFilename,
      port: 1234,
    });
  });

  it("should return merged configuration with user cli options overriding config file", async () => {
    const command = await new Command()
      .name("swa")
      .option<number>("--port <port>", "", parsePort, 4444)
      .parseAsync(["node", "swa", "--port", "4567"]);

    mockFs({
      "swa-cli.config.json": JSON.stringify({
        configurations: {
          test: { port: 1234 },
        },
      }),
    });

    expect(await configureOptions("test", { config: swaCliConfigFilename, port: 4567 }, command, "init")).toStrictEqual({
      config: swaCliConfigFilename,
      port: 4567,
    });
  });

  it("should return merged configuration with command specific options overriding global options", async () => {
    const command = await new Command().option<number>("--port <port>", "", parsePort, 4444).parseAsync([]);

    mockFs({
      "swa-cli.config.json": JSON.stringify({
        configurations: {
          test: {
            port: 1234,
            init: { port: 4567 },
          },
        },
      }),
    });

    expect(await configureOptions("test", { config: swaCliConfigFilename, port: 4444 }, command, "init")).toStrictEqual({
      config: swaCliConfigFilename,
      port: 4567,
    });
  });
});

describe("Testing aliases for each of the commands and their options", () => {
  it("should return appropriate user cli options for the alias commands for global options", async () => {
    const command = await new Command()
      .name("swa")
      .option("-V, --verbose [prefix]", "", DEFAULT_CONFIG.verbose)
      .option("-c, --config <path>", "")
      .option("-g, --print-config", "", false)
      .option("-w, --swa-config-location <swaConfigLocation>", "")
      .parseAsync(["node", "swa", "-V", "log", "-c", `../${swaCliConfigFilename}`, "-g", "-w", `${DEFAULT_CONFIG.swaConfigLocation}`]);

    expect(getUserOptions(command)).toStrictEqual({
      verbose: "log",
      config: `../${swaCliConfigFilename}`,
      printConfig: true,
      swaConfigLocation: DEFAULT_CONFIG.swaConfigLocation,
    });
  });
});
