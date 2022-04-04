import chalk from "chalk";
import { Command, Option, program } from "commander";
import path from "path";
import updateNotifier from "update-notifier";
import { DEFAULT_CONFIG } from "../config";
import { parseDevserverTimeout, parsePort } from "../core";
import { swaCliConfigFilename } from "../core/utils/cli-config";
import { configureOptions } from "../core/utils/options";
import { deploy } from "./commands/deploy";
import { login } from "./commands/login";
import { start } from "./commands/start";
const pkg = require("../../package.json");

const printWelcomeMessage = () => {
  // don't use logger here: SWA_CLI_DEBUG is not set yet
  console.log(chalk.dim.gray(`[swa]`));
  console.log(chalk.dim.gray(`[swa]`), `Azure Static Web App CLI v${pkg.version}`);
  console.log(chalk.dim.gray(`[swa]`));
};

export const defaultStartContext = `.${path.sep}`;

export async function run(argv?: string[]) {
  printWelcomeMessage();

  // Once a day, check for updates
  updateNotifier({ pkg }).notify();

  program
    .name("swa")
    .usage("<command> [options]")
    .version(pkg.version, "-v, --version")

    /////////////////////////////////////////////////////////////////////////////////
    // SWA CLI common configuration options
    /////////////////////////////////////////////////////////////////////////////////
    // SWA config
    .addOption(
      new Option("--verbose [prefix]", "enable verbose output. Values are: silly,info,log,silent")
        .preset(DEFAULT_CONFIG.verbose)
        .default(DEFAULT_CONFIG.verbose)
    )
    .addHelpText("after", "\nDocumentation:\n  https://aka.ms/swa/cli-local-development\n")

    .option("--config <path>", "Path to swa-cli.config.json file to use", path.relative(process.cwd(), swaCliConfigFilename))
    .option("--print-config", "Print all resolved options", false)
    .option(
      "--swa-config-location <swaConfigLocation>",
      "The directory where the staticwebapp.config.json file is located",
      DEFAULT_CONFIG.swaConfigLocation
    );

  /////////////////////////////////////////////////////////////////////////////////
  // start command
  /////////////////////////////////////////////////////////////////////////////////
  program
    .command("login")
    .usage("[options]")
    .description("login into Azure Static Web Apps")
    .option("--persist", "Enable credentials cache persistence", DEFAULT_CONFIG.persist)
    .option("--subscription [subscriptionId]", "Azure subscription ID used by this project", DEFAULT_CONFIG.subscriptionId)
    .option("--resource-group [resourceGroup]", "Azure resource group used by this project", DEFAULT_CONFIG.resourceGroup)
    .option("--tenant [tenantId]", "Azure tenant ID", DEFAULT_CONFIG.tenantId)
    .option("--app-name [appName]", "Azure Static Web App application name", DEFAULT_CONFIG.appName)

    .action(async (_options: SWACLIConfig, command: Command) => {
      const config = await configureOptions("./", command.optsWithGlobals(), command);
      await login(config.options);
    });

  program
    .command("start [context]")
    .usage("[context] [options]")
    .description("Start the emulator from a directory or bind to a dev server")
    .option("--app-location <appLocation>", "The folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("--api-location <apiLocation>", "The folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option<number>("--api-port <apiPort>", "The API server port passed to `func start`", parsePort, DEFAULT_CONFIG.apiPort)
    .option("--host <host>", "The host address to use for the CLI dev server", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "The port value to use for the CLI dev server", parsePort, DEFAULT_CONFIG.port)

    // hide this flag from the help output
    .addOption(new Option("--build", "Build the front-end app and API before starting the emulator").default(false).hideHelp())

    .option("--ssl", "Serve the front-end application and API over HTTPS", DEFAULT_CONFIG.ssl)
    .option("--ssl-cert <sslCertLocation>", "The SSL certificate (.crt) to use when enabling HTTPS", DEFAULT_CONFIG.sslCert)
    .option("--ssl-key <sslKeyLocation>", "The SSL key (.key) to use when enabling HTTPS", DEFAULT_CONFIG.sslKey)
    .option("--run <startupScript>", "Run a custon shell command or file at startup", DEFAULT_CONFIG.run)
    .option<number>(
      "--devserver-timeout <devserverTimeout>",
      "The time to wait (in ms) when connecting to a front-end application's dev server",
      parseDevserverTimeout,
      DEFAULT_CONFIG.devserverTimeout
    )

    .option("--open", "Automatically open the CLI dev server in the default browser", DEFAULT_CONFIG.open)
    .option("--func-args <funcArgs>", "Pass additional arguments to the func start command")

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

  /////////////////////////////////////////////////////////////////////////////////
  // deploy command
  /////////////////////////////////////////////////////////////////////////////////
  program
    .command("deploy [context]")
    .usage("[context] [options]")
    .description("Deploy the current project to Azure Static Web Apps")
    .option("--api-location <apiLocation>", "The folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("--deployment-token <secret>", "The secret toekn used to authenticate with the Static Web Apps")
    .option("--dry-run", "Simulate a deploy process without actually running it", DEFAULT_CONFIG.dryRun)
    .action(async (context: string = `.${path.sep}`, _options: SWACLIConfig, command: Command) => {
      const config = await configureOptions(context, command.optsWithGlobals(), command);
      await deploy(config.context, config.options);
    })
    .addHelpText(
      "after",
      `
Examples:

  Deploy using a deployment token
  swa deploy ./dist/ --api-location ./api/ --deployment-token <token>

  Deploy using a deployment token from env
  SWA_CLI_DEPLOYMENT_TOKEN=123 swa deploy ./dist/ --api-location ./api/

  Deploy using swa-cli.config.json file
  swa deploy
  swa deploy myconfig
    `
    );

  await program.parseAsync(argv);
}
