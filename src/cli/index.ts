import dotenv from "dotenv";
dotenv.config();

import chalk from "chalk";
import { Command, Option, program } from "commander";
import path from "path";
import updateNotifier from "update-notifier";
import { DEFAULT_CONFIG } from "../config";
import { configureOptions, getCurrentSwaCliConfigFromFile, logger, runCommand, swaCliConfigFilename } from "../core";
import registerDeploy from "./commands/deploy";
import registerInit from "./commands/init";
import registerLogin from "./commands/login";
import registerStart from "./commands/start";
import registerBuild from "./commands/build";
import { promptOrUseDefault } from "../core/prompts";

export * from "./commands";

const pkg = require("../../package.json");

const printWelcomeMessage = () => {
  if (!process.env.SWA_CLI_INTERNAL_COMMAND) {
    // don't use logger here: SWA_CLI_DEBUG is not set yet
    console.log(``);
    console.log(`Welcome to Azure Static Web Apps CLI (${chalk.green(pkg.version)})`);
    console.log(``);
  }
};

export async function run(argv?: string[]) {
  printWelcomeMessage();

  // Once a day, check for updates
  updateNotifier({ pkg }).notify();

  program
    .name("swa")
    .usage("[command] [options]")
    .version(pkg.version, "-v, --version")

    // SWA CLI common configuration options
    .addOption(
      new Option("--verbose [prefix]", "enable verbose output. Values are: silly,info,log,silent")
        .preset(DEFAULT_CONFIG.verbose)
        .default(DEFAULT_CONFIG.verbose)
    )
    .option("--config <path>", "path to swa-cli.config.json file to use", path.relative(process.cwd(), swaCliConfigFilename))
    .option("--config-name <name>", "name of the configuration to use", undefined)
    .option("--print-config", "print all resolved options", false)
    .option(
      "--swa-config-location <swaConfigLocation>",
      "the directory where the staticwebapp.config.json file is located",
      DEFAULT_CONFIG.swaConfigLocation
    )
    .action(async (_options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(undefined, command.optsWithGlobals(), command, "init");
      swaMagic(options);
    })
    .addHelpText("after", `
  Type "swa" to get started and deploy your project.
  
  Documentation:
    https://aka.ms/swa/cli-local-development
  `);

  // Register commands
  registerLogin(program);
  registerStart(program);
  registerDeploy(program);
  registerInit(program);
  registerBuild(program);

  program.showHelpAfterError();

  await program.parseAsync(argv);
}

export async function swaMagic(_options: SWACLIConfig) {
  const hasLoadedConfig = getCurrentSwaCliConfigFromFile();
  if (!hasLoadedConfig) {
    runCommand("swa init")
  }
  runCommand("swa build");

  const response = await promptOrUseDefault(false, {
    type: "confirm",
    name: "deploy",
    message: "Do you want to deploy your app now?",
    initial: true
  });
  if (!response.deploy) {
    logger.log(`\nWhen you'll be ready to deploy your app, just use ${chalk.cyan("swa")} again.`);
    return;
  }

  runCommand("swa deploy");
}
