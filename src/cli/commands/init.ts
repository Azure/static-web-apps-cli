import chalk from "chalk";
import { Command } from "commander";
import path from "path";
// import fs from "fs";
import process from "process";
import { DEFAULT_CONFIG } from "../../config";
import { promptOrUseDefault } from "../../core/prompts";
import {
  configureOptions,
  dasherize,
  hasConfigurationNameInConfigFile,
  logger,
  swaCliConfigFileExists,
  swaCliConfigFilename,
  writeConfigFile,
} from "../../core/utils";

export default function registerCommand(program: Command) {
  program
    .command("init [name]")
    .usage("[name] [options]")
    .description("initialize a new static web app project")
    .option("--yes", "answer yes to all prompts (disable interactive mode)", false)
    .action(async (name: string, _options: SWACLIConfig, command: Command) => {
      const config = await configureOptions(undefined, command.optsWithGlobals(), command);
      await init(name, config.options);
    });
}

export async function init(name: string | undefined, options: SWACLIConfig, showHints: boolean = true) {
  const configFilePath = options.config!;
  const disablePrompts = options.yes ?? false;
  const outputFolder = process.cwd();
  let projectName: string = name?.trim() ?? "";

  if (projectName === "") {
    const response = await promptOrUseDefault(disablePrompts, {
      type: "text",
      name: "projectName",
      message: "Choose a project name:",
      initial: dasherize(path.basename(outputFolder)),
      validate: (value: string) => value.trim() !== "" || "Project name cannot be empty",
      format: (value: string) => dasherize(value.trim()),
    });
    projectName = response.projectName;
  }

  // TODO: start from template
  // if (isEmptyFolder(outputFolder)) {
  //   // Do you want to create a new project from a template?
  // }

  // TODO: run framework detection
  let projectConfig: FrameworkConfig = {
    appLocation: DEFAULT_CONFIG.appLocation!,
    outputLocation: DEFAULT_CONFIG.outputLocation!,
    appBuildCommand: DEFAULT_CONFIG.appBuildCommand!,
    apiBuildCommand: DEFAULT_CONFIG.apiBuildCommand!,
  };

  projectConfig = await promptConfigSettings(disablePrompts, projectConfig);
  logger.silly(projectConfig);

  // printFrameworkConfig(projectConfig);

  // TODO: confirm settings
  // const { confirmSettings } = await promptOrUseDefault(disablePrompts, {
  //   type: 'confirm',
  //   name: 'confirmSettings',
  //   message: 'Are these settings correct?',
  //   initial: true
  // });
  // if (!confirmSettings) {
  //   // Ask for each settings
  //   projectConfig = await promptConfigSettings(disablePrompts, projectConfig);
  // }

  if (swaCliConfigFileExists(configFilePath) && (await hasConfigurationNameInConfigFile(configFilePath, projectName))) {
    const { confirmOverwrite } = await promptOrUseDefault(disablePrompts, {
      type: "confirm",
      name: "confirmOverwrite",
      message: `Configuration with name "${projectName}" already exists, overwrite?`,
      initial: true,
    });
    if (!confirmOverwrite) {
      logger.log("Aborted, configuration not saved.");
      return;
    }
  }

  const cliConfig = convertToCliConfig(projectConfig);
  await writeConfigFile(configFilePath, projectName, cliConfig);
  logger.log(chalk.green(`\nConfiguration successfully saved to ${swaCliConfigFilename}.\n`));

  if (showHints) {
    logger.log(chalk.bold(`Get started with the following commands:`));
    logger.log(`- Use ${chalk.cyan("swa start")} to run your app locally.`);
    logger.log(`- Use ${chalk.cyan("swa deploy")} to deploy your app to Azure.\n`);
  }
}

function convertToCliConfig(config: FrameworkConfig): SWACLIConfig {
  return {
    appLocation: config.appLocation,
    apiLocation: config.apiLocation,
    outputLocation: config.outputLocation,
    appBuildCommand: config.appBuildCommand,
    apiBuildCommand: config.apiBuildCommand,
    run: config.devServerCommand,
    start: {
      context: config.devServerUrl || config.outputLocation,
    },
    deploy: {
      context: config.outputLocation,
    },
  };
}

async function promptConfigSettings(disablePrompts: boolean, detectedConfig: FrameworkConfig): Promise<FrameworkConfig> {
  const trimValue = (value: string) => {
    value = value.trim();
    return value === "" ? undefined : value;
  };
  const response = await promptOrUseDefault(disablePrompts, [
    {
      type: "text",
      name: "appLocation",
      message: "What's your app location?",
      initial: detectedConfig.appLocation,
      validate: (value: string) => value.trim() !== "" || "App location cannot be empty",
      format: trimValue,
    },
    {
      type: "text",
      name: "outputLocation",
      message: "What's your build output location?",
      hint: "If your app doesn't have a build process, use the same location as your app",
      initial: detectedConfig.outputLocation,
      validate: (value: string) => value.trim() !== "" || "Output location cannot be empty",
      format: trimValue,
    },
    {
      type: "text",
      name: "apiLocation",
      message: "What's your API location? (optional)",
      initial: detectedConfig.apiLocation,
      format: trimValue,
    },
    {
      type: "text",
      name: "appBuildCommand",
      message: "What command do you use to build your app? (optional)",
      initial: detectedConfig.appBuildCommand,
      format: trimValue,
    },
    {
      type: "text",
      name: "apiBuildCommand",
      message: "What command do you use to build your API? (optional)",
      initial: detectedConfig.apiBuildCommand,
      format: trimValue,
    },
    {
      type: "text",
      name: "devServerCommand",
      message: "What command do you use to run your app for development? (optional)",
      initial: detectedConfig.devServerCommand,
      format: trimValue,
    },
    {
      type: "text",
      name: "devServerUrl",
      message: "What is your development server url (optional)",
      initial: detectedConfig.devServerUrl,
      format: trimValue,
    },
  ]);
  return response;
}

// function printFrameworkConfig(config: FrameworkConfig) {
//   logger.log(chalk.bold('\nDetected configuration for your app:'));
//   logger.log(`- Framework: ${chalk.green(config.name ?? 'none')}`);
//   logger.log(`- App location: ${chalk.green(config.appLocation)}`);
//   logger.log(`- Output location: ${chalk.green(config.outputLocation)}`);
//   logger.log(`- API location: ${chalk.green(config.apiLocation ?? '')}`);
//   logger.log(`- App build command: ${chalk.green(config.appBuildCommand ?? '')}`);
//   logger.log(`- API build command: ${chalk.green(config.apiBuildCommand ?? '')}`);
//   logger.log(`- Dev command: ${chalk.green(config.devServerCommand ?? '')}`);
//   logger.log(`- Dev server URL: ${chalk.green(config.devServerUrl ?? '')}\n`);
// }

// function isEmptyFolder(path: string) {
//   const files = fs.readdirSync(path);
//   return files.length === 0;
// }
