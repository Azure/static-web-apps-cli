export * from "./commands";

import chalk from "chalk";
import { Option, program } from "commander";
import path from "path";
import updateNotifier from "update-notifier";
import { DEFAULT_CONFIG } from "../config";
import { swaCliConfigFilename } from "../core/utils/cli-config";
import registerDeploy from "./commands/deploy";
import registerInit from "./commands/init";
import registerLogin from "./commands/login";
import registerStart from "./commands/start";
const pkg = require("../../package.json");

const printWelcomeMessage = () => {
  // don't use logger here: SWA_CLI_DEBUG is not set yet
  console.log(``);
  console.log(`Welcome to Azure Static Web App CLI ${chalk.green(pkg.version)}`);
  console.log(``);
};

export async function run(argv?: string[]) {
  printWelcomeMessage();

  // Once a day, check for updates
  updateNotifier({ pkg }).notify();

  program
    .name("swa")
    .usage("<command> [options]")
    .version(pkg.version, "-v, --version")

    // SWA CLI common configuration options
    .addOption(
      new Option("--verbose [prefix]", "enable verbose output. Values are: silly,info,log,silent")
        .preset(DEFAULT_CONFIG.verbose)
        .default(DEFAULT_CONFIG.verbose)
    )
    .addHelpText("after", "\nDocumentation:\n  https://aka.ms/swa/cli-local-development\n")

    .option("--config <path>", "path to swa-cli.config.json file to use", path.relative(process.cwd(), swaCliConfigFilename))
    .option("--print-config", "print all resolved options", false)
    .option(
      "--swa-config-location <swaConfigLocation>",
      "the directory where the staticwebapp.config.json file is located",
      DEFAULT_CONFIG.swaConfigLocation
    )
    .option("--subscription [subscriptionId]", "Azure subscription ID used by this project", DEFAULT_CONFIG.subscriptionId)
    .option("--resource-group-name [resourceGroupName]", "Azure resource group used by this project", DEFAULT_CONFIG.resourceGroupName)
    .option("--tenant [tenantId]", "Azure tenant ID", DEFAULT_CONFIG.tenantId)
    .option("--client-id [clientId]", "Azure client ID", DEFAULT_CONFIG.clientId)
    .option("--client-secret [clientSecret]", "Azure client secret", DEFAULT_CONFIG.clientSecret)
    .option("--app-name [appName]", "Azure Static Web App application name", DEFAULT_CONFIG.appName);

  // Register commands
  registerLogin(program);
  registerStart(program);
  registerDeploy(program);
  registerInit(program);

  await program.parseAsync(argv);
}
