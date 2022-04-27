import { Command } from "commander";
import mockFs from "mock-fs";
import { swaCliConfigFilename } from "./cli-config";
import { parsePort } from "./net";
import { parseDevserverTimeout } from "./cli";
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
  it("should return appropriate user cli options for the alias commands for swa global options", async () => {
    const command = await new Command()
      .name("swa")
      .option("-V, --verbose [prefix]", "", DEFAULT_CONFIG.verbose)
      .option("-c, --config <path>")
      .option("-g, --print-config", "", false)
      .option("-w, --swa-config-location <swaConfigLocation>")
      .parseAsync(["node", "swa", "-V", "log", "-c", `../${swaCliConfigFilename}`, "-g", "-w", `${DEFAULT_CONFIG.swaConfigLocation}`]);

    expect(getUserOptions(command)).toStrictEqual({
      verbose: "log",
      config: `../${swaCliConfigFilename}`,
      printConfig: true,
      swaConfigLocation: DEFAULT_CONFIG.swaConfigLocation,
    });
  });

  it("should return appropriate user cli options for the alias commands for swa start options", async () => {
    const command = await new Command()
      .name("swa")
      .option("-a, --app-location <appLocation>")
      .option("-i, --api-location <apiLocation>")
      .option<number>("-j, --api-port <apiPort>", "", parsePort, DEFAULT_CONFIG.apiPort)
      .option("-q, --host <host>")
      .option<number>("-p, --port <port>", "", parsePort, DEFAULT_CONFIG.port)
      .option("-s, --ssl")
      .option("-e, --ssl-cert <sslCertLocation>")
      .option("-k, --ssl-key <sslKeyLocation>")
      .option("-r, --run <startupScript>")
      .option<number>("-t, --devserver-timeout <devserverTimeout>", "", parseDevserverTimeout, DEFAULT_CONFIG.devserverTimeout)
      .option("-o, --open")
      .option("-f, --func-args <funcArgs>")
      .parseAsync([
        "node",
        "swa",
        "-a",
        `${DEFAULT_CONFIG.appLocation}`,
        "-i",
        "./api",
        "-j",
        "7071",
        "-q",
        `${DEFAULT_CONFIG.host}`,
        "-p",
        "4567",
        "-s",
        "-e",
        "./ssl/sslCert.crt",
        "-k",
        "./ssl/sslKey.key",
        "-r",
        "run.sh",
        "-t",
        "1000",
        "-o",
        "-f",
        "--arg",
      ]);

    expect(getUserOptions(command)).toStrictEqual({
      appLocation: DEFAULT_CONFIG.appLocation,
      apiLocation: "./api",
      apiPort: 7071,
      host: DEFAULT_CONFIG.host,
      port: 4567,
      ssl: true,
      sslCert: "./ssl/sslCert.crt",
      sslKey: "./ssl/sslKey.key",
      run: "run.sh",
      devserverTimeout: 1000,
      open: true,
      funcArgs: "--arg",
    });
  });
});
