import chalk from "chalk";
import { Command } from "commander";
import { DEFAULT_CONFIG } from "../../../config";
import { configureOptions, isHttpUrl, isUserOption, logger, matchLoadedConfigName, parseServerTimeout, parsePort } from "../../../core";
import { start } from "./start";

export default function registerCommand(program: Command) {
  program
    .command("start [configName|outputLocation|appDevserverUrl]")
    .usage("[configName|outputLocation|appDevserverUrl] [options]")
    .description("start the emulator from a directory or bind to a dev server")
    .option("-a, --app-location <path>", "the folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("-i, --api-location <path>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("-db, --data-api-location <path>", "the path to the data-api config file", DEFAULT_CONFIG.dataApiLocation)
    .option("-O, --output-location <path>", "the folder containing the built source of the front-end application", DEFAULT_CONFIG.outputLocation)
    .option(
      "-D, --app-devserver-url <url>",
      "connect to the app dev server at this URL instead of using output location",
      DEFAULT_CONFIG.appDevserverUrl
    )
    .option("-is, --api-devserver-url <url>", "connect to the api server at this URL instead of using api location", DEFAULT_CONFIG.apiDevserverUrl)
    .option("-ds, --data-api-devserver-url <url>", "connect to the data-api server at this URL", DEFAULT_CONFIG.dataApiDevserverUrl)
    .option<number>("-j, --api-port <apiPort>", "the API server port passed to `func start`", parsePort, DEFAULT_CONFIG.apiPort)
    .option("-q, --host <host>", "the host address to use for the CLI dev server", DEFAULT_CONFIG.host)
    .option<number>("-p, --port <port>", "the port value to use for the CLI dev server", parsePort, DEFAULT_CONFIG.port)

    .option("-s, --ssl", "serve the front-end application and API over HTTPS", DEFAULT_CONFIG.ssl)
    .option("-e, --ssl-cert <sslCertLocation>", "the SSL certificate (.crt) to use when enabling HTTPS", DEFAULT_CONFIG.sslCert)
    .option("-k, --ssl-key <sslKeyLocation>", "the SSL key (.key) to use when enabling HTTPS", DEFAULT_CONFIG.sslKey)
    .option("-r, --run <startupScript>", "run a custom shell command or script file at startup", DEFAULT_CONFIG.run)
    .option<number>(
      "-t, --devserver-timeout <time>",
      "the time to wait (in seconds) when connecting to a front-end application's dev server or api server",
      parseServerTimeout,
      DEFAULT_CONFIG.devserverTimeout
    )
    .option(
      "-w, --swa-config-location <swaConfigLocation>",
      "the directory where the staticwebapp.config.json file is located",
      DEFAULT_CONFIG.swaConfigLocation
    )
    .option("-o, --open", "open the browser to the dev server", DEFAULT_CONFIG.open)
    .option("-f, --func-args <funcArgs>", "pass additional arguments to the func start command")
    .option("-sc, --schema <schemaUrl>", "URL to the custom schema for staticwebapp.config.json", DEFAULT_CONFIG.schemaUrl)
    .action(async (positionalArg: string | undefined, _options: SWACLIConfig, command: Command) => {
      positionalArg = positionalArg?.trim();
      const options = await configureOptions(positionalArg, command.optsWithGlobals(), command, "start");
      if (positionalArg && !matchLoadedConfigName(positionalArg)) {
        // If it's not the config name, it's either output location or dev server url
        const isUrl = isHttpUrl(positionalArg);
        if (isUrl) {
          if (isUserOption("appDevserverUrl")) {
            logger.error(`swa deploy <appDevserverUrl> cannot be used when --app-devserver-url option is also set.`);
            logger.error(`You either have to use the positional argument or option, not both at the same time.`, true);
          }
          options.appDevserverUrl = positionalArg;
        } else {
          if (isUserOption("outputLocation")) {
            logger.error(`swa deploy <outputLocation> cannot be used when --output-location option is also set.`);
            logger.error(`You either have to use the positional argument or option, not both at the same time.`, true);
          }
          options.outputLocation = positionalArg;
        }
      }

      console.warn(chalk.yellow("***********************************************************************"));
      console.warn(chalk.yellow("* WARNING: This emulator may not match the cloud environment exactly. *"));
      console.warn(chalk.yellow("* Always deploy and test your app in Azure.                           *"));
      console.warn(chalk.yellow("***********************************************************************"));
      console.warn();

      await start(options);
    })
    .addHelpText(
      "after",
      `
Examples:

Serve static content from a specific folder
swa start ./output-folder

Connect to an already running framework development server
swa start http://localhost:3000

Use staticwebapp.config.json file from a specific location
swa start http://localhost:3000 --swa-config-location ./app-source

Serve static content from a folder and run an API from another folder
swa start ./output-folder --api-location ./api

Use a custom command to run framework development server at startup
swa start http://localhost:3000 --run-build "npm start"

Serve static content from a folder and start data-api-server from another folder
swa start ./output-folder --data-api-location ./swa-db-connections

Connect front-end to the data-api-dev-server running
swa start ./output-folder --data-api-devserver-url http://localhost:5000

Connect both front-end and the API to running development server
swa start http://localhost:3000 --api-devserver-url http://localhost:7071
  `
    );
}
