import dotenv from "dotenv";
dotenv.config();

import process from "process";
import chalk from "chalk";
import { Command, Option, program } from "commander";
import path from "path";
import updateNotifier from "update-notifier";
import { DEFAULT_CONFIG } from "../config";
import { configureOptions, getCurrentSwaCliConfigFromFile, getNodeMajorVersion, logger, runCommand, swaCliConfigFilename } from "../core";
import registerDeploy from "./commands/deploy";
import registerInit from "./commands/init";
import registerLogin from "./commands/login";
import registerStart from "./commands/start";
import registerBuild from "./commands/build";
import registerDocs from "./commands/docs";
import { promptOrUseDefault } from "../core/prompts";

export * from "./commands";

const pkg = require("../../package.json");

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
  const nodeMajorVersion = getNodeMajorVersion();
  const minVersion = pkg.engines.node.substring(2, pkg.engines.node.indexOf("."));

  if (nodeMajorVersion < minVersion) {
    logger.error(`You are using Node ${process.versions.node} but this version of the CLI requires Node ${minVersion} or higher.`);
    logger.error(`Please upgrade your Node version.\n`, true);
  }
}

export async function run(argv?: string[]) {
  printWelcomeMessage(argv);

  // Once a day, check for updates
  updateNotifier({ pkg }).notify();

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
      if ((_options as any).ping) {
        try {
          require("child_process").execSync("npx command-line-pong", { stdio: ["inherit", "inherit", "ignore"] });
        } catch (e) {
          console.log("pong!");
        }
        return;
      }

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
