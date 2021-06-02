import program, { Option } from "commander";
import path from "path";
import { DEFAULT_CONFIG } from "../config";
import { parsePort } from "../core";
import { start } from "./commands/start";

exports.run = async function () {
  const cli: SWACLIConfig & program.Command = program
    .name("swa")
    .usage("<command> [options]")
    .version(require("../../package.json").version, "-v, --version")

    // SWA config
    .option("--verbose [prefix]", "enable verbose output. Values are: silly,info,log,silent", DEFAULT_CONFIG.verbose)

    .addHelpText("after", "\nDocumentation:\n  https://aka.ms/swa/cli-local-development\n");

  program
    .command("start [context]")
    .usage("[context] [options]")
    .description("start the emulator from a directory or bind to a dev server")
    .option("--app-location <appLocation>", "set location for the static app source code", DEFAULT_CONFIG.appLocation)
    .option(
      "--app, --app-artifact-location <outputLocation>",
      "set the location of the build output directory relative to the --app-location.",
      DEFAULT_CONFIG.outputLocation
    )
    .option("--api, --api-location <apiLocation>", "set the API folder or Azure Functions emulator address", DEFAULT_CONFIG.apiLocation)
    .option(
      "--swa-config-location <swaConfigLocation>",
      "set the directory where the staticwebapp.config.json file is found",
      DEFAULT_CONFIG.swaConfigLocation
    )

    // CLI config
    .option<number>("--api-port <apiPort>", "set the API backend port", parsePort, DEFAULT_CONFIG.apiPort)
    .option("--host <host>", "set the cli host address", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "set the cli port", parsePort, DEFAULT_CONFIG.port)

    .addOption(new Option("--build", "build the app and API before starting the emulator").default(false).hideHelp())

    .option("--ssl", "serve the app and API over HTTPS", DEFAULT_CONFIG.ssl)
    .option("--ssl-cert <sslCertLocation>", "SSL certificate (.crt) to use for serving HTTPS", DEFAULT_CONFIG.sslCert)
    .option("--ssl-key <sslKeyLocation>", "SSL key (.key) to use for serving HTTPS", DEFAULT_CONFIG.sslKey)

    .option("--run <startupScript>", "run a command at startup", DEFAULT_CONFIG.run)

    .action(async (context: string = `.${path.sep}`, options: SWACLIConfig) => {
      options = {
        ...options,
        verbose: cli.opts().verbose,
      };

      // make sure the start command gets the right verbosity level
      process.env.SWA_CLI_DEBUG = options.verbose;
      if (options.verbose?.includes("silly")) {
        // when silly level is set,
        // propagate debugging level to other tools using the DEBUG environment variable
        process.env.DEBUG = "*";
      }

      await start(context, options);
    })

    .addHelpText(
      "after",
      `
Examples:

  Serve static content from a specific folder
  swa start ./output-folder

  Use an already running framework development server
  swa start http://localhost:3000

  Use staticwebapp.config.json file in a specific location
  swa start http://localhost:3000 --swa-config-location ./app-source

  Serve static content and run an API from another folder
  swa start ./output-folder --api ./api

  Use a custom command to run framework development server at startup
  swa start http://localhost:3000 --run "npm start"
    `
    );

  await program.parseAsync(process.argv);
};
