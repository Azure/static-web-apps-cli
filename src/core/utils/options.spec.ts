import { Command } from "commander";
import mockFs from "mock-fs";
import { swaCliConfigFilename } from "./cli-config";
import { parsePort } from "./net";
import { parseServerTimeout } from "./cli";
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
      .option("-cn, --config-name <name>")
      .option("-g, --print-config", "", false)
      .parseAsync(["node", "swa", "-V", "log", "-c", `../${swaCliConfigFilename}`, "-cn", `${swaCliConfigFilename}`, "-g"]);

    expect(getUserOptions(command)).toStrictEqual({
      verbose: "log",
      config: `../${swaCliConfigFilename}`,
      configName: `${swaCliConfigFilename}`,
      printConfig: true,
    });
  });

  it("should return appropriate user cli options for the alias commands for swa start options", async () => {
    const command = await new Command()
      .name("swa")
      .option("-a, --app-location <appLocation>")
      .option("-i, --api-location <apiLocation>")
      .option("-O, --output-location <outputLocation>")
      .option("-D, --app-devserver-url <url>")
      .option("-is, --api-devserver-url <url>")
      .option<number>("-j, --api-port <apiPort>", "", parsePort, DEFAULT_CONFIG.apiPort)
      .option("-q, --host <host>")
      .option<number>("-p, --port <port>", "", parsePort, DEFAULT_CONFIG.port)
      .option("-s, --ssl")
      .option("-e, --ssl-cert <sslCertLocation>")
      .option("-k, --ssl-key <sslKeyLocation>")
      .option("-r, --run <startupScript>")
      .option<number>("-t, --devserver-timeout <time>", "", parseServerTimeout, DEFAULT_CONFIG.devserverTimeout)
      .option("-w, --swa-config-location <swaConfigLocation>")
      .option("-o, --open")
      .option("-f, --func-args <funcArgs>")
      .parseAsync([
        "node",
        "swa",
        "-a",
        `${DEFAULT_CONFIG.appLocation}`,
        "-i",
        "./api",
        "-O",
        `./build`,
        "-D",
        "https://swa-dev-server.com",
        "-is",
        "https://swa-dev-server.com/api/v2",
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
        "-w",
        "./config",
        "-o",
        "-f",
        "--arg",
      ]);

    expect(getUserOptions(command)).toStrictEqual({
      appLocation: DEFAULT_CONFIG.appLocation,
      apiLocation: "./api",
      outputLocation: "./build",
      appDevserverUrl: "https://swa-dev-server.com",
      apiDevserverUrl: "https://swa-dev-server.com/api/v2",
      apiPort: 7071,
      host: DEFAULT_CONFIG.host,
      port: 4567,
      ssl: true,
      sslCert: "./ssl/sslCert.crt",
      sslKey: "./ssl/sslKey.key",
      run: "run.sh",
      devserverTimeout: 1000,
      swaConfigLocation: "./config",
      open: true,
      funcArgs: "--arg",
    });
  });

  it("should return appropriate user cli options for the alias commands for swa deploy options", async () => {
    const command = await new Command()
      .name("swa")
      .option("-d, --deployment-token <secret>")
      .option("-dr, --dry-run")
      .option("-pt, --print-token")
      .parseAsync(["node", "swa", "-d", "1234abcd", "-dr", "-pt"]);

    expect(getUserOptions(command)).toStrictEqual({
      deploymentToken: "1234abcd",
      dryRun: true,
      printToken: true,
    });
  });

  it("should return appropriate user cli options for the alias commands for swa init options", async () => {
    const command = await new Command().name("swa").option("-y, --yes").parseAsync(["node", "swa", "-y"]);

    expect(getUserOptions(command)).toStrictEqual({
      yes: true,
    });
  });

  it("should return appropriate user cli options for the alias commands for swa build options", async () => {
    const command = await new Command()
      .name("swa")
      .option("-A, --app-build-command <command>")
      .option("-I, --api-build-command <command>")
      .parseAsync(["node", "swa", "-A", "build-app", "-I", "build-api"]);

    expect(getUserOptions(command)).toStrictEqual({
      appBuildCommand: "build-app",
      apiBuildCommand: "build-api",
    });
  });

  it("should return appropriate user cli options for the alias commands for swa login options", async () => {
    const command = await new Command()
      .name("swa")
      .option("-S, --subscription-id [subscriptionId]")
      .option("-R, --resource-group [resourceGroupName]")
      .option("-T, --tenant-id [tenantId]")
      .option("-C, --client-id [clientId]")
      .option("-CS, --client-secret [clientSecret]")
      .option("-n, --app-name [appName]")
      .option("-cc, --clear-credentials")
      .option("-u, --use-keychain")
      .option("-nu, --no-use-keychain")
      .parseAsync([
        "node",
        "swa",
        "-S",
        "subscriptionId",
        "-R",
        "resourceGroup",
        "-T",
        "tenantId",
        "-C",
        "clientId",
        "-CS",
        "clientSecret",
        "-n",
        "appName",
        "-cc",
        "-nu",
      ]);

    expect(getUserOptions(command)).toStrictEqual({
      subscriptionId: "subscriptionId",
      resourceGroup: "resourceGroup",
      tenantId: "tenantId",
      clientId: "clientId",
      clientSecret: "clientSecret",
      appName: "appName",
      useKeychain: false,
      clearCredentials: true,
    });
  });
});
