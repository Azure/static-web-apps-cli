import dotenv from "dotenv";
dotenv.config();

import process from "node:process";
import chalk from "chalk";
import { Command, Option, program } from "commander";
import path from "node:path";
import { notifyOnUpdate } from "../core/utils/update-notifier.js";
import { DEFAULT_CONFIG } from "../config.js";
import { configureOptions } from "../core/utils/options.js";
import { getCurrentSwaCliConfigFromFile, swaCliConfigFilename } from "../core/utils/cli-config.js";
import { getNodeMajorVersion } from "../core/func-core-tools.js";
import { logger } from "../core/utils/logger.js";
import { runCommand } from "../core/utils/command.js";
import { default as registerDeploy } from "./commands/deploy/register.js";
import { default as registerInit } from "./commands/init/register.js";
import { default as registerLogin } from "./commands/login/register.js";
import { default as registerStart } from "./commands/start/register.js";
import { default as registerBuild } from "./commands/build/register.js";
import { registerDocs } from "./commands/docs.js";
import { default as registerDb } from "./commands/db/init/register.js";
import { promptOrUseDefault } from "../core/prompts.js";
import pkg from "../../package.json";

function printWelcomeMessage(argv?: string[]) {
  const args = argv?.slice(2) || [];
  const showVersion = args.includes("--version") || args.includes("-v") || args.includes("--ping");
  const hideMessage = process.env.SWA_CLI_INTERNAL_COMMAND || showVersion;

  if (!hideMessage) {
    // don't use logger here: SWA_CLI_DEBUG is not set yet
    console.log(``);
    console.log(`Welcome to Azure Static Web Apps CLI (${chalk.green(pkg.version)})`);
    console.log(``);
  }

  if (!showVersion) {
    checkNodeVersion();
  }
}

function checkNodeVersion() {
  const nodeMajorVersion: number = getNodeMajorVersion();
  const minVersion: number = parseInt(pkg.engines.node.substring(2, pkg.engines.node.indexOf(".")));

  if (nodeMajorVersion < minVersion) {
    logger.error(`You are using Node ${process.versions.node} but this version of the CLI requires Node ${minVersion} or higher.`);
    logger.error(`Please upgrade your Node version.\n`, true);
  }
}

export async function run(argv?: string[]) {
  printWelcomeMessage(argv);
  notifyOnUpdate();

  program
    .name("swa")
    .usage("[command] [options]")
    .version(pkg.version, "-v, --version")

    // SWA CLI common configuration options
    .addOption(
      new Option("-V, --verbose [prefix]", "enable verbose output. Values are: silly,info,log,silent")
        .preset(DEFAULT_CONFIG.verbose)
        .default(DEFAULT_CONFIG.verbose)
    )
    .option("-c, --config <path>", "path to swa-cli.config.json file to use", path.relative(process.cwd(), swaCliConfigFilename))
    .option("-cn, --config-name <name>", "name of the configuration to use", undefined)
    .option("-g, --print-config", "print all resolved options", false)
    .action(async (_options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(undefined, command.optsWithGlobals(), command, "init");
      swaMagic(options);
    })
    .addHelpText(
      "after",
      `
  Type "swa" to get started and deploy your project.

  Documentation:
    https://aka.ms/swa/cli-local-development
  `
    );

  // Register commands
  registerLogin(program);
  registerStart(program);
  registerDeploy(program);
  registerInit(program);
  registerBuild(program);
  registerDocs(program);
  registerDb(program);

  program.showHelpAfterError();
  program.addOption(new Option("--ping").hideHelp());

  await program.parseAsync(argv);
}

export async function swaMagic(_options: SWACLIConfig) {
  try {
    const hasLoadedConfig = getCurrentSwaCliConfigFromFile();
    if (!hasLoadedConfig) {
      logger.log(`${chalk.cyan("→")} No configuration found, running ${chalk.cyan("swa init")}...\n`);
      runCommand("swa init");
    }

    logger.log(`${chalk.cyan("→")} Running ${chalk.cyan("swa build")}...\n`);
    runCommand("swa build");
    logger.log("");

    const response = await promptOrUseDefault(false, {
      type: "confirm",
      name: "deploy",
      message: "Do you want to deploy your app now?",
      initial: true,
    });
    if (!response.deploy) {
      logger.log(`\nWhen you'll be ready to deploy your app, just use ${chalk.cyan("swa")} again.`);
      return;
    }

    logger.log(`\n${chalk.cyan("→")} Running ${chalk.cyan("swa deploy")}...\n`);
    runCommand("swa deploy");
  } catch (_) {
    // Pokemon, go catch'em all!
    // (Errors are already caught an displayed in individual commands)
  }
}
