import path from "path";
import chalk from "chalk";
import { detectProjectFolders, generateConfiguration } from "../../../core/frameworks";
import {
  findUpPackageJsonDir,
  isUserOrConfigOption,
  logger,
  pathExists,
  readWorkflowFile,
  runCommand,
  swaCliConfigFilename,
} from "../../../core/utils";
import { collectTelemetryEvent } from "../../../core/telemetry/utils";
import { TELEMETRY_EVENTS } from "../../../core/constants";

export async function build(options: SWACLIConfig) {
  const start = new Date().getTime();
  const workflowConfig = readWorkflowFile();

  logger.silly({
    workflowConfig,
    options: {
      appLocation: options.appLocation,
      apiLocation: options.apiLocation,
      outputLocation: options.outputLocation,
      appBuildCommand: options.appBuildCommand,
      apiBuildCommand: options.apiBuildCommand,
    },
  });

  let appLocation = options.appLocation ?? workflowConfig?.appLocation;
  let apiLocation = options.apiLocation ?? workflowConfig?.apiLocation;
  let outputLocation = options.outputLocation ?? workflowConfig?.outputLocation;
  let appBuildCommand = options.appBuildCommand ?? workflowConfig?.appBuildCommand;
  let apiBuildCommand = options.apiBuildCommand ?? workflowConfig?.apiBuildCommand;

  if (options.auto && hasBuildOptionsDefined(options)) {
    logger.error(`You can't use the --auto option when you have defined appBuildCommand or apiBuildCommand in ${swaCliConfigFilename}`);
    logger.error(`or with the --app-build-command and --api-build-command options.`, true);
    return;
  }

  let projectConfig;
  const detectedFolders = await detectProjectFolders(appLocation);
  projectConfig = await generateConfiguration(detectedFolders.app[0], detectedFolders.api[0]);
  if (options.auto) {
    logger.log("Detecting build configuration...");

    if (detectedFolders.app.length === 0 && detectedFolders.api.length === 0) {
      logger.error(`Your app configuration could not be detected.`);
      return showAutoErrorMessageAndExit();
    } else if (detectedFolders.app.length > 1 || detectedFolders.api.length > 1) {
      logger.error(`Multiple apps found in your project folder.`);
      return showAutoErrorMessageAndExit();
    }

    try {
      appLocation = projectConfig.appLocation;
      apiLocation = projectConfig.apiLocation;
      outputLocation = projectConfig.outputLocation;
      apiBuildCommand = projectConfig.apiBuildCommand;
      appBuildCommand = projectConfig.appBuildCommand;
    } catch (error) {
      logger.error(`Cannot generate your build configuration:`);
      logger.error(error as Error, true);
      return;
    }
  }

  if (!appBuildCommand && !apiBuildCommand) {
    if (!hasBuildOptionsDefined(options)) {
      logger.warn("No build options were defined.");
      logger.warn('If your app needs a build step, run "swa init" to set your project configuration');
      logger.warn(`or use option flags to set your build commands and paths.\n`);
    }

    logger.log("Nothing to build.");
    return;
  }

  logger.log(`Build configuration:`);
  logger.log(`- App location: ${chalk.green(appLocation || "")}`);
  logger.log(`- API location: ${chalk.green(apiLocation || "")}`);
  logger.log(`- Output location: ${chalk.green(outputLocation || "")}`);
  logger.log(`- App build command: ${chalk.green(appBuildCommand || "")}`);
  logger.log(`- API build command: ${chalk.green(apiBuildCommand || "")}`);

  if (appBuildCommand) {
    const packageJsonPath = await findUpPackageJsonDir(appLocation!, outputLocation!);
    if (packageJsonPath) {
      logger.log(`Found package.json in ${packageJsonPath}`);
      await installNpmDependencies(packageJsonPath);
    }

    logger.log(`Building app with ${chalk.green(appBuildCommand)} in ${chalk.dim(appLocation)} ...`);
    runCommand(appBuildCommand, appLocation!);
  }

  if (apiBuildCommand) {
    // For now, only look up in the api location as there's no equivalent to outputLocation for api
    const packageJsonPath = await findUpPackageJsonDir(apiLocation!, ".");
    if (packageJsonPath) {
      logger.log(`Found package.json in ${packageJsonPath}`);
      await installNpmDependencies(packageJsonPath);
    }

    logger.log(`Building api with ${chalk.green(apiBuildCommand)} in ${chalk.dim(apiLocation)} ...`);
    runCommand(apiBuildCommand, apiLocation!);
  }
  const end = new Date().getTime();

  collectTelemetryEvent(TELEMETRY_EVENTS.Build, {
    appFramework: projectConfig?.name?.split(", with")[0]!,
    duration: (end - start).toLocaleString(),
  });
}

function hasBuildOptionsDefined(options: SWACLIConfig): boolean {
  if (options.appBuildCommand || options.apiBuildCommand) {
    return true;
  }
  return isUserOrConfigOption("appBuildCommand") || isUserOrConfigOption("apiBuildCommand");
}

function showAutoErrorMessageAndExit() {
  logger.error(`Please run "swa init" to set your configuration or use option flags to set your`);
  logger.error(`build commands and paths.`, true);
}

async function detectPackageManager(basePath: string): Promise<NpmPackageManager> {
  const hasYarnLock = await pathExists(path.join(basePath, "yarn.lock"));
  const hasNpmLock = await pathExists(path.join(basePath, "package-lock.json"));
  const hasPnpmLock = await pathExists(path.join(basePath, "pnpm-lock.yaml"));

  if (hasPnpmLock && !hasNpmLock && !hasYarnLock) {
    return "pnpm";
  }

  if (hasYarnLock && !hasNpmLock) {
    return "yarn";
  }

  return "npm";
}

async function installNpmDependencies(packageJsonPath: string): Promise<void> {
  try {
    const packageManager = await detectPackageManager(packageJsonPath);
    logger.log(`Installing dependencies with "${packageManager} install"...`);
    runCommand(`${packageManager} install`, packageJsonPath);
  } catch (error) {
    logger.error(`Cannot install dependencies:`);
    logger.error(error as Error, true);
  }
}
