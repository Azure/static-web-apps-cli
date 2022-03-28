import { program, Option, Command } from "commander";
import path from "path";
import { DEFAULT_CONFIG } from "../config";
import { parsePort } from "../core";
import { parseDevserverTimeout } from "../core";
import { start } from "./commands/start";
import updateNotifier from "update-notifier";
import { swaCliConfigFilename } from "../core/utils/cli-config";
import { configureOptions } from "../core/utils/options";
const pkg = require("../../package.json");

export const defaultStartContext = `.${path.sep}`;

export async function run(argv?: string[]) {
  // Once a day, check for updates
  updateNotifier({ pkg }).notify();

  program
    .name("swa")
    .usage("<command> [options]")
    .version(pkg.version, "-v, --version")

    // SWA config
    .addOption(new Option("--verbose [prefix]", "enable verbose output. Values are: silly,info,log,silent").preset(DEFAULT_CONFIG.verbose))
    .addHelpText("after", "\nDocumentation:\n  https://aka.ms/swa/cli-local-development\n")

    .option("--config <path>", "Path to swa-cli.config.json file to use.", path.relative(process.cwd(), swaCliConfigFilename))
    .option("--print-config", "Print all resolved options.", false);

  program
    .command("start [context]")
    .usage("[context] [options]")
    .description("start the emulator from a directory or bind to a dev server")
    .option("--app-location <appLocation>", "set location for the static app source code", DEFAULT_CONFIG.appLocation)
    .option("--api-location <apiLocation>", "set the API folder or Azure Functions emulator address", DEFAULT_CONFIG.apiLocation)
    .option(
      "--swa-config-location <swaConfigLocation>",
      "set the directory where the staticwebapp.config.json file is located",
      DEFAULT_CONFIG.swaConfigLocation
    )

    // CLI config
    .option<number>("--api-port <apiPort>", "set the API backend port", parsePort, DEFAULT_CONFIG.apiPort)
    .option("--host <host>", "set the cli host address", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "set the cli port", parsePort, DEFAULT_CONFIG.port)

    // hide this flag from the help output
    .addOption(new Option("--build", "build the app and API before starting the emulator").default(false).hideHelp())

    .option("--ssl", "serve the app and API over HTTPS", DEFAULT_CONFIG.ssl)
    .option("--ssl-cert <sslCertLocation>", "SSL certificate (.crt) to use for serving HTTPS", DEFAULT_CONFIG.sslCert)
    .option("--ssl-key <sslKeyLocation>", "SSL key (.key) to use for serving HTTPS", DEFAULT_CONFIG.sslKey)

    .option("--run <startupScript>", "run a command at startup", DEFAULT_CONFIG.run)
    .option<number>(
      "--devserver-timeout <devserverTimeout>",
      "time to wait (in ms) for the dev server to start",
      parseDevserverTimeout,
      DEFAULT_CONFIG.devserverTimeout
    )

    .option("--open", "open the browser to the dev server", DEFAULT_CONFIG.open)
    .option("--func-args <funcArgs>", "pass additional arguments to the func start command")

    .action(async (context: string = `.${path.sep}`, _options: SWACLIConfig, command: Command) => {
      const config = await configureOptions(context, command.optsWithGlobals(), command);
      await start(config.context, config.options);
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
  swa start ./output-folder --api-location ./api

  Use a custom command to run framework development server at startup
  swa start http://localhost:3000 --run "npm start"
    `
    );

  await program.parseAsync(argv);
}
