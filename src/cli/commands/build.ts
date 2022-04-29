import path from "path";
import chalk from "chalk";
import { Command } from "commander";
import { execSync } from 'child_process';
import { DEFAULT_CONFIG } from "../../config";
import { detectProjectFolders, generateConfiguration } from "../../core/frameworks";
import {
  configureOptions, findUpPackageJsonDir, isUserOrConfigOption, logger, pathExists, readWorkflowFile, swaCliConfigFilename,
} from "../../core/utils";

export default function registerCommand(program: Command) {
  program
    .command("build [configurationName|outputLocation]")
    .usage("[configurationName|outputLocation] [options]")
    .description("build your project")
    .option("--app-location <appLocation>", "the folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("--api-location <apiLocation>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("--output-location <outputLocation>", "the folder where the front-end public files are location", DEFAULT_CONFIG.outputLocation)
    .option("--app-build-command <command>", "the command used to build your app", DEFAULT_CONFIG.appBuildCommand)
    .option("--api-build-command <command>", "the command used to build your api", DEFAULT_CONFIG.apiBuildCommand)
    .option("--auto", "automatically detect how to build your app and api", false)
    .action(async (configOrOutputLocation: string = `.${path.sep}`, _options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(configOrOutputLocation, command.optsWithGlobals(), command, "build");
      await build(options);
    });
}

export async function build(options: SWACLIConfig) {
  const workflowConfig = readWorkflowFile();

  logger.silly({
    workflowConfig,
    options: {
      appLocation: options.appLocation,
      apiLocation: options.apiLocation,
      outputLocation: options.outputLocation,
      appBuildCommand: options.appBuildCommand,
      apiBuildCommand: options.apiBuildCommand,
    }
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

  if (options.auto) {
    logger.log('Detecting build configuration...');
    const detectedFolders = await detectProjectFolders(appLocation);

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
      logger.warn('No build options were defined.');
      logger.warn(`Please run "swa init" to set your project configuration or use option flags to set your`);
      logger.warn(`build commands and paths.\n`);
    }

    logger.log('Nothing to build.');
    return;
  }

  logger.log(`Build configuration:`);
  logger.log(`- App location: ${chalk.green(appLocation || '')}`);
  logger.log(`- API location: ${chalk.green(apiLocation || '')}`);
  logger.log(`- Output location: ${chalk.green(outputLocation || '')}`);
  logger.log(`- App build command: ${chalk.green(appBuildCommand || '')}`);
  logger.log(`- API build command: ${chalk.green(apiBuildCommand || '')}`);
  
  if (appBuildCommand) {
    let buildPath = appLocation!;
    const packageJsonPath = await findUpPackageJsonDir(appLocation!, outputLocation!);
    if (packageJsonPath) {
      logger.log(`Found package.json in ${packageJsonPath}`);
      await installNpmDependencies(packageJsonPath);
      buildPath = packageJsonPath;
    }

    logger.log(`Building app with ${chalk.green(appBuildCommand)} in ${chalk.dim(buildPath)}...`);
    runCommand(appBuildCommand, buildPath!);
  }

  if (apiBuildCommand) {
    let buildPath = appLocation!;
    const packageJsonPath = await findUpPackageJsonDir(appLocation!, apiLocation!);
    if (packageJsonPath) {
      logger.log(`Found package.json in ${packageJsonPath}`);
      await installNpmDependencies(packageJsonPath);
      buildPath = packageJsonPath;
    }

    logger.log(`Building api with ${chalk.green(apiBuildCommand)} in ${chalk.dim(buildPath)}...`);
    runCommand(apiBuildCommand, buildPath!);
  }
}

function hasBuildOptionsDefined(options: SWACLIConfig): boolean {
  if (options.appBuildCommand || options.apiBuildCommand) {
    return true;
  }
  return isUserOrConfigOption('appBuildCommand') || isUserOrConfigOption('apiBuildCommand');
}

function showAutoErrorMessageAndExit() {
  logger.error(`Please run "swa init" to set your configuration or use option flags to set your`);
  logger.error(`build commands and paths.`, true);
}

async function detectPackageManager(basePath: string): Promise<NpmPackageManager> {
  const hasYarnLock = await pathExists(path.join(basePath, 'yarn.lock'));
  const hasNpmLock = await pathExists(path.join(basePath, 'package-lock.json'));
  const hasPnpmLock = await pathExists(path.join(basePath, 'pnpm-lock.yaml'));

  if (hasPnpmLock && !hasNpmLock && !hasYarnLock) {
    return 'pnpm';
  }

  if (hasYarnLock && !hasNpmLock) {
    return 'yarn';
  }

  return 'npm';
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

function runCommand(command: string, cwd: string) {
  execSync(command, {
    stdio: 'inherit',
    cwd,
    // Set CI to avoid extra NPM logs and potentially unwanted interactive modes
    env: { ...process.env, CI: "1" }
  });
}
