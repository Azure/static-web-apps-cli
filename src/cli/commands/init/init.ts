import chalk from "chalk";
import path from "path";
import process from "process";
import { promptOrUseDefault } from "../../../core/prompts";
import {
  dasherize,
  getFlagsUsed,
  hasConfigurationNameInConfigFile,
  logger,
  swaCliConfigFileExists,
  swaCliConfigFilename,
  writeConfigFile,
} from "../../../core/utils";
import { detectProjectFolders, generateConfiguration, isDescendantPath } from "../../../core/frameworks";
import { collectTelemetryEvent } from "../../../core/telemetry/utils";
import { TELEMETRY_ERROR_TYPE, TELEMETRY_EVENTS, TELEMETRY_RESPONSE_TYPE } from "../../../core/constants";

export async function init(options: SWACLIConfig, showHints: boolean = true) {
  const cmdStartTime = new Date().getTime();
  const flagsUsed = getFlagsUsed(options);
  const flagsUsedStr = JSON.stringify(flagsUsed);

  const configFilePath = options.config!;
  const disablePrompts = options.yes ?? false;
  const outputFolder = process.cwd();
  let configName: string = options.configName?.trim() ?? "";

  if (configName === "") {
    const response = await promptOrUseDefault(disablePrompts, {
      type: "text",
      name: "configName",
      message: "Choose a configuration name:",
      initial: dasherize(path.basename(outputFolder)),
      validate: (value: string) => value.trim() !== "" || "Configuration name cannot be empty",
      format: (value: string) => dasherize(value.trim()),
    });
    configName = response.configName;
  }

  // TODO: start from template
  // if (isEmptyFolder(outputFolder)) {
  //   // Do you want to create a new project from a template?
  // }

  const detectedFolders = await detectProjectFolders();
  let app: DetectedFolder | undefined = detectedFolders.app[0];
  let api: DetectedFolder | undefined = detectedFolders.api[0];

  if (detectedFolders.app.length > 1) {
    logger.silly(`More than one (${detectedFolders.app.length}) app folders found`);

    const response = await promptOrUseDefault(disablePrompts, {
      type: "select",
      name: "app",
      message: "Which app folder do you want to use?",
      choices: detectedFolders.app.map((folder) => ({ title: folder.rootPath, value: folder })),
      initial: 0,
    });

    // Workaround for bug https://github.com/terkelg/prompts/issues/205
    app = typeof response.app === "number" ? detectedFolders.app[response.app] : response.app;
  }

  // Check if we can find api folders under selected app folder, and filter selection if we found some
  if (app !== undefined) {
    const childApiFolders = detectedFolders.api.filter((folder) => isDescendantPath(folder.rootPath, app!.rootPath));
    if (childApiFolders.length > 0) {
      logger.silly(`Found (${childApiFolders.length}) api folders under the app folder`);
      logger.silly(`- ${childApiFolders.map((f) => `${f.rootPath} (${f.frameworks.map((fr) => fr.name).join(", ")})`).join("\n- ")}`);
      detectedFolders.api = childApiFolders;
    }
  }

  if (detectedFolders.api.length > 1) {
    logger.silly(`More than one (${detectedFolders.api.length}) api folders found`);

    const response = await promptOrUseDefault(disablePrompts, {
      type: "select",
      name: "api",
      message: "Which api folder do you want to use?",
      choices: detectedFolders.api.map((folder) => ({ title: folder.rootPath, value: folder })),
      initial: 0,
    });

    // Workaround for bug https://github.com/terkelg/prompts/issues/205
    api = typeof response.api === "number" ? detectedFolders.api[response.api] : response.api;
  } else {
    api = detectedFolders.api[0];
  }

  let projectConfig;
  try {
    projectConfig = await generateConfiguration(app, api);
  } catch (error) {
    logger.error(`Cannot generate your project configuration:`);
    logger.error(error as Error, true);
    const cmdEndTime = new Date().getTime();
    await collectTelemetryEvent(TELEMETRY_EVENTS.Init, {
      duration: (cmdEndTime - cmdStartTime).toString(),
      flagsUsed: flagsUsedStr,
      responseType: TELEMETRY_RESPONSE_TYPE.PreConditionFailure,
      errorType: TELEMETRY_ERROR_TYPE.InitFailure,
      errorMessage: "Couldn't generate build configuration",
    });
    return;
  }

  printFrameworkConfig(projectConfig);

  const { confirmSettings } = await promptOrUseDefault(disablePrompts, {
    type: "confirm",
    name: "confirmSettings",
    message: "Are these settings correct?",
    initial: true,
  });
  if (!confirmSettings) {
    // Ask for each settings
    projectConfig = await promptConfigSettings(disablePrompts, projectConfig);
  }

  if (swaCliConfigFileExists(configFilePath) && (await hasConfigurationNameInConfigFile(configFilePath, configName))) {
    const { confirmOverwrite } = await promptOrUseDefault(disablePrompts, {
      type: "confirm",
      name: "confirmOverwrite",
      message: `Configuration with name "${configName}" already exists, overwrite?`,
      initial: true,
    });
    if (!confirmOverwrite) {
      logger.log("Aborted, configuration not saved.");
      const cmdEndTime = new Date().getTime();
      await collectTelemetryEvent(TELEMETRY_EVENTS.Init, {
        duration: (cmdEndTime - cmdStartTime).toString(),
        flagsUsed: flagsUsedStr,
        responseType: TELEMETRY_RESPONSE_TYPE.PartialSuccess,
      });
      return;
    }
  }

  const cliConfig = convertToCliConfig(projectConfig);
  await writeConfigFile(configFilePath, configName, cliConfig);
  logger.log(chalk.green(`\nConfiguration successfully saved to ${swaCliConfigFilename}.\n`));

  if (showHints) {
    logger.log(chalk.bold(`Get started with the following commands:`));
    logger.log(`- Use ${chalk.cyan("swa start")} to run your app locally.`);

    if (cliConfig.appBuildCommand || cliConfig.apiBuildCommand) {
      logger.log(`- Use ${chalk.cyan("swa build")} to build your app.`);
    }

    logger.log(`- Use ${chalk.cyan("swa deploy")} to deploy your app to Azure.\n`);
  }
  const cmdEndTime = new Date().getTime();
  await collectTelemetryEvent(TELEMETRY_EVENTS.Init, {
    appFramework: projectConfig?.name?.split(", with")[0]!,
    flagsUsed: flagsUsedStr,
    duration: (cmdEndTime - cmdStartTime).toString(),
    responseType: TELEMETRY_RESPONSE_TYPE.Success,
  });
}

function convertToCliConfig(config: FrameworkConfig): SWACLIConfig {
  return {
    appLocation: config.appLocation,
    apiLocation: config.apiLocation,
    outputLocation: config.outputLocation,
    appBuildCommand: config.appBuildCommand,
    apiBuildCommand: config.apiBuildCommand,
    run: config.appDevserverCommand,
    appDevserverUrl: config.appDevserverUrl,
    apiDevserverUrl: config.apiDevserverUrl,
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
      name: "appDevserverCommand",
      message: "What command do you use to run your app for development? (optional)",
      initial: detectedConfig.appDevserverCommand,
      format: trimValue,
    },
    {
      type: "text",
      name: "appDevserverUrl",
      message: "What's your app development server URL (optional)",
      initial: detectedConfig.appDevserverUrl,
      format: trimValue,
    },
    {
      type: "text",
      name: "apiDevserverUrl",
      message: "What's your API development server URL (optional)",
      initial: detectedConfig.apiDevserverUrl,
      format: trimValue,
    },
  ]);
  return response;
}

function printFrameworkConfig(config: FrameworkConfig) {
  logger.log(chalk.bold("\nDetected configuration for your app:"));
  logger.log(`- Framework(s): ${chalk.green(config.name ?? "none")}`);
  logger.log(`- App location: ${chalk.green(config.appLocation)}`);
  logger.log(`- Output location: ${chalk.green(config.outputLocation)}`);
  logger.log(`- API location: ${chalk.green(config.apiLocation ?? "")}`);
  logger.log(`- App build command: ${chalk.green(config.appBuildCommand ?? "")}`);
  logger.log(`- API build command: ${chalk.green(config.apiBuildCommand ?? "")}`);
  logger.log(`- App dev server command: ${chalk.green(config.appDevserverCommand ?? "")}`);
  logger.log(`- App dev server URL: ${chalk.green(config.appDevserverUrl ?? "")}\n`);
  logger.log(`- API dev server URL: ${chalk.green(config.apiDevserverUrl ?? "")}\n`);
}
