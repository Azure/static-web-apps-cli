import program, { Option } from "commander";
import path from "path";
import { DEFAULT_CONFIG } from "../config";
import { logger, parsePort } from "../core";
import { parseDevserverTimeout } from "../core";
import { start } from "./commands/start";
import updateNotifier from "update-notifier";
import { getFileOptions, swaCliConfigFilename } from "../core/utils/cli-config";
import { login } from "./commands/login";
const pkg = require("../../package.json");

const processConfigurationFile = async (cli: SWACLIConfig & GithubActionWorkflow & program.Command, context: string, options: SWACLIConfig) => {
  const verbose = cli.opts().verbose;

  // make sure the start command gets the right verbosity level
  process.env.SWA_CLI_DEBUG = verbose;
  if (verbose?.includes("silly")) {
    // when silly level is set,
    // propagate debugging level to other tools using the DEBUG environment variable
    process.env.DEBUG = "*";
  }
  const fileOptions = await getFileOptions(context, cli.opts().config);

  options = {
    ...options,
    ...fileOptions,
    verbose,
  };

  if (cli.opts().printConfig) {
    logger.log("", "swa");
    logger.log("Options: ", "swa");
    logger.log({ ...DEFAULT_CONFIG, ...options }, "swa");
  }

  return {
    options,
    fileOptions,
  };
};

export const defaultStartContext = `.${path.sep}`;

export async function run(argv?: string[]) {
  // Once a day, check for updates
  updateNotifier({ pkg }).notify();

  const cli: SWACLIConfig & program.Command = program
    .name("swa")
    .usage("<command> [options]")
    .version(pkg.version, "-v, --version")

    /////////////////////////////////////////////////////////////////////////////////
    // SWA CLI common configuration options
    /////////////////////////////////////////////////////////////////////////////////

    .option("--verbose [prefix]", "enable verbose output. Values are: silly,info,log,silent", DEFAULT_CONFIG.verbose)
    .addHelpText("after", "\nDocumentation:\n  https://aka.ms/swa/cli-local-development\n")

    .option("--config <path>", "Path to swa-cli.config.json file to use", path.relative(process.cwd(), swaCliConfigFilename))
    .option("--print-config", "Print all resolved options", false);

  /////////////////////////////////////////////////////////////////////////////////
  // start command
  /////////////////////////////////////////////////////////////////////////////////
  program
    .command("login")
    .usage("<command> [options]")
    .description("login into Azure Static Web Apps")
    .option("--persist", "Enable credentials cache persistence", DEFAULT_CONFIG.persist)
    .option("--subscription [subscriptionId]", "Azure subscription ID used by this project", DEFAULT_CONFIG.subscriptionId)
    .option("--resource-group [resourceGroup]", "Azure resource group used by this project", DEFAULT_CONFIG.resourceGroup)
    .option("--tenant [tenantId]", "Azure tenant ID", DEFAULT_CONFIG.tenantId)
    .option("--app-name [appName]", "Azure Static Web App application name", DEFAULT_CONFIG.appName)

    .action(async (context: string = `.${path.sep}`, options: SWACLIConfig) => {
      const verbose = cli.opts().verbose;

      // make sure the start command gets the right verbosity level
      process.env.SWA_CLI_DEBUG = verbose;
      if (verbose?.includes("silly")) {
        // when silly level is set,
        // propagate debugging level to other tools using the DEBUG environment variable
        process.env.DEBUG = "*";
      }
      const fileOptions = await getFileOptions(context, cli.opts().config);

      options = {
        ...options,
        ...fileOptions,
        verbose,
      };

      if (cli.opts().printConfig) {
        logger.log("", "swa");
        logger.log("Options: ", "swa");
        logger.log({ ...DEFAULT_CONFIG, ...options }, "swa");
      }

      await login(options);
    });

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
    .action(async (context = DEFAULT_CONFIG.outputLocation as string, parsedOptions: SWACLIConfig) => {
      let { options, fileOptions } = await processConfigurationFile(cli, context, parsedOptions);
      await start(fileOptions.context ?? context, options);
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
    .description("deploy the current project to Azure Static Web Apps")
    .option("--output-location <outputLocation>", "the location for the static app built folder")
    .option("--api-location <apiLocation>", "the location for the API built folder")
    .option("--deployment-token <secret>", "the secret toekn used to authenticate with the Static Web Apps")
    .action(async (context = DEFAULT_CONFIG.outputLocation as string, parsedOptions: SWACLIConfig) => {
      let { options, fileOptions } = await processConfigurationFile(cli, context, parsedOptions);
      await deploy(fileOptions.context ?? context, options);
    })
    .addHelpText(
      "after",
      `
Examples:

  Deploy using a deployment token
  swa deploy --output-location ./app/dist/ --api-location ./api/ --deployment-token <token>

  Deploy without a deployment token (requires swa login)
  swa deploy --output-location ./app/dist/ --api-location ./api/

  Deploy using swa-cli.config.json file
  swa deploy myproject
  swa deploy --config ./swa-cli.config.json myproject
    `
    );

  await program.parseAsync(argv);
}
