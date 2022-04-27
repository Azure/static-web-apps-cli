import chalk from "chalk";
import { Command } from "commander";
import concurrently from "concurrently";
import { DEFAULT_CONFIG } from "../../config";
import { detectProjectFolders, generateConfiguration } from "../../core/frameworks";
import {
  configureOptions, isUserOrConfigOption, logger, readWorkflowFile, swaCliConfigFilename,
} from "../../core/utils";

export default function registerCommand(program: Command) {
  program
    .command("build [configurationName]")
    .usage("[configurationName] [options]")
    .description("build your static web app project")
    .option("--app-location <appLocation>", "the folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("--api-location <apiLocation>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("--app-build-command <command>", "the command used to build your app", DEFAULT_CONFIG.appBuildCommand)
    .option("--api-build-command <command>", "the command used to build your api", DEFAULT_CONFIG.apiBuildCommand)
    .option("--auto", "automatically detect how to build your app and api", false)
    .action(async (configurationName: string, _options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(configurationName, command.optsWithGlobals(), command, "build");
      await build(options);
    });
}

export async function build(options: SWACLIConfig) {
  // TODO: check package.json/node_modules and call npm/yarn/pnpm install

  const workflowConfig = readWorkflowFile();

  logger.silly({
    workflowConfig,
    options: {
      appLocation: options.appLocation,
      appBuildCommand: options.appBuildCommand,
      apiBuildCommand: options.apiBuildCommand,
    }
  });

  let appLocation = options.appLocation !== undefined ? options.appLocation : workflowConfig?.appLocation;
  let appBuildCommand = options.appBuildCommand !== undefined ? options.appBuildCommand : workflowConfig?.appBuildCommand;
  let apiBuildCommand = options.apiBuildCommand !== undefined ? options.apiBuildCommand : workflowConfig?.apiBuildCommand;

  if (options.auto && hasBuildOptionsDefined(options)) {
    logger.error(`You can't use the --auto option when you have defined appBuildCommand or apiBuildCommand in ${swaCliConfigFilename}`);
    logger.error(`or with the --app-build-command and --api-build-command options.`, true);
    return;
  }

  if (options.auto) {
    const detectedFolders = await detectProjectFolders();

    if (detectedFolders.app.length === 0 && detectedFolders.api.length === 0) {
      logger.error(`Your app configuration could not be detected.`);
      return showAutoErrorMessageAndExit();
    } else if (detectedFolders.app.length > 1 || detectedFolders.api.length > 1) {
      logger.error(`Multiple apps found in your project folder.`);
      return showAutoErrorMessageAndExit();
    }

    let projectConfig;
    try {
      projectConfig = await generateConfiguration(detectedFolders.app[0], detectedFolders.api[0]);
      appLocation = projectConfig.appLocation;
      apiBuildCommand = projectConfig.apiBuildCommand;
      appBuildCommand = projectConfig.appBuildCommand;
    } catch (error) {
      logger.error(`Cannot generate your project configuration:`);
      logger.error(error as Error, true);
      return;
    }
  }
  
  if (!appBuildCommand && !apiBuildCommand) {
    logger.log('Nothing to build.');
    return;
  }
  
  if (appBuildCommand) {
    logger.log(`Building app using $${chalk.green(appBuildCommand)}...`);
    await concurrently(
      [{
          command: appBuildCommand,
          name: "app",
          prefixColor: "dim.gray",
          env: {
            CI: "1",
          },
      }],
      {
        cwd: appLocation,
        killOthers: "failure",
      }
    );
  }

  if (apiBuildCommand) {
    logger.log(`Building api using $${chalk.green(appBuildCommand)}...`);
    await concurrently(
      [{
          command: apiBuildCommand,
          name: "api",
          prefixColor: "dim.gray",
          env: {
            CI: "1",
          },
      }],
      {
        cwd: appLocation,
        killOthers: "failure",
      }
    );
  }
}

function hasBuildOptionsDefined(options: SWACLIConfig): boolean {
  if (options.appBuildCommand || options.apiBuildCommand) {
    return true;
  }
  return isUserOrConfigOption('appBuildCommand') || isUserOrConfigOption('apiBuildCommand');
}

function showAutoErrorMessageAndExit() {
  logger.error(`Please "swa init" to set your configuration or use the --app-build-command`);
  logger.error(`and --api-build-command options.`, true);
  logger.error(``, true);
}
