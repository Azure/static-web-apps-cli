import chalk from "chalk";
import { spawn } from "child_process";
import { Command } from "commander";
import fs from "fs";
import ora from "ora";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import {
  configureOptions,
  findSWAConfigFile,
  getCurrentSwaCliConfigFromFile,
  logger,
  logGiHubIssueMessageAndExit,
  readWorkflowFile,
  updateSwaCliConfigFile,
} from "../../core";
import { chooseOrCreateProjectDetails, getStaticSiteDeployment } from "../../core/account";
import { cleanUp, getDeployClientPath } from "../../core/deploy-client";
import { swaCLIEnv } from "../../core/env";
import { addSharedLoginOptionsToCommand, login } from "./login";

const packageInfo = require(path.join(__dirname, "..", "..", "..", "package.json"));

export default function registerCommand(program: Command) {
  const deployCommand = program
    .command("deploy [outputLocation]")
    .usage("[outputLocation] [options]")
    .description("Deploy the current project to Azure Static Web Apps")
    .option("--api-location <apiLocation>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("--deployment-token <secret>", "the secret token used to authenticate with the Static Web Apps")
    .option("--dry-run", "simulate a deploy process without actually running it", DEFAULT_CONFIG.dryRun)
    .option("--print-token", "print the deployment token", false)
    .option("--env [environment]", "the type of deployment environment where to deploy the project", DEFAULT_CONFIG.env)
    .action(async (context: string = `.${path.sep}`, _options: SWACLIConfig, command: Command) => {
      const config = await configureOptions(context, command.optsWithGlobals(), command);
      await deploy(config.options);
    })
    .addHelpText(
      "after",
      `
Examples:

  Deploy using a deployment token
  swa deploy ./dist/ --api-location ./api/ --deployment-token <token>

  Deploy using a deployment token from env
  SWA_CLI_DEPLOYMENT_TOKEN=123 swa deploy ./dist/ --api-location ./api/

  Deploy using swa-cli.config.json file
  swa deploy
  swa deploy myconfig

  Print the deployment token
  swa deploy --print-token

  Deploy to a specific environment
  swa deploy --env production
    `
    );
  addSharedLoginOptionsToCommand(deployCommand);
}

export async function deploy(options: SWACLIConfig) {
  const { SWA_CLI_DEPLOYMENT_TOKEN, SWA_CLI_DEBUG } = swaCLIEnv();
  const isVerboseEnabled = SWA_CLI_DEBUG === "silly";

  let { appLocation, outputLocation, apiLocation, dryRun, deploymentToken, printToken, appName, swaConfigLocation, verbose } = options;

  if (dryRun) {
    logger.warn("***********************************************************************");
    logger.warn("* WARNING: Running in dry run mode. This project will not be deployed *");
    logger.warn("***********************************************************************");
    logger.warn("");
  }

  // make sure outputLocation is set
  outputLocation = path.resolve(outputLocation || process.cwd());

  // make sure appLocation is set
  appLocation = path.resolve(appLocation || process.cwd());

  // if folder exists, deploy from a specific build folder (outputLocation), relative to appLocation
  if (!fs.existsSync(outputLocation)) {
    logger.error(`The folder "${outputLocation}" is not found. Exit.`, true);
    return;
  }

  logger.log(`Deploying front-end files from folder:`);
  logger.log(`  ${chalk.green(outputLocation)}`);
  logger.log(``);

  // if --api-location is provided, use it as the api folder
  if (apiLocation) {
    const userApiFolder = path.resolve(path.join(appLocation!, apiLocation!));
    if (!fs.existsSync(userApiFolder)) {
      logger.error(`The provided API folder ${userApiFolder} does not exist. Abort.`, true);
      return;
    } else {
      logger.log(`Deploying API from folder:`);
      logger.log(`  ${chalk.green(userApiFolder)}`);
      logger.log(``);
    }
  }
  // otherwise, check if the default api folder exists and print a warning
  else {
    const defaultApiFolder = path.normalize(path.join(appLocation, DEFAULT_CONFIG.apiPrefix!));
    if (fs.existsSync(defaultApiFolder)) {
      logger.warn(
        `An API folder was found at ".${
          // TODO: should handle ./Api and ./api
          path.sep + path.basename(defaultApiFolder)
        }" but the --api-location option was not provided. The API will not be deployed.\n`
      );
    }
  }

  // resolve the deployment token
  if (deploymentToken) {
    deploymentToken = deploymentToken;
    logger.silly("Deployment token provide via flag");
    logger.silly({ [chalk.green(`--deployment-token`)]: deploymentToken });
  } else if (SWA_CLI_DEPLOYMENT_TOKEN) {
    deploymentToken = SWA_CLI_DEPLOYMENT_TOKEN;
    logger.silly("Deployment token found in Environment Variables:");
    logger.silly({ [chalk.green(`SWA_CLI_DEPLOYMENT_TOKEN`)]: SWA_CLI_DEPLOYMENT_TOKEN });
  } else if (dryRun === false) {
    logger.silly(`No deployment token found. Trying interactive login...`);

    try {
      const { credentialChain, subscriptionId } = await login({
        ...options,
      });

      logger.silly(`Login successful`);

      if (appName) {
        logger.log(`\nChecking project "${appName}" settings...`);
      } else {
        logger.log(`\nChecking project settings...`);
      }

      const { resourceGroupName, staticSiteName } = (await chooseOrCreateProjectDetails(options, credentialChain, subscriptionId)) as {
        resourceGroupName: string;
        staticSiteName: string;
      };

      logger.silly(`Project settings:`);
      logger.silly({
        resourceGroupName,
        staticSiteName,
        subscriptionId,
      });

      const deploymentTokenResponse = await getStaticSiteDeployment(
        credentialChain,
        subscriptionId,
        resourceGroupName as string,
        staticSiteName as string
      );

      deploymentToken = deploymentTokenResponse?.properties?.apiKey;

      if (!deploymentToken) {
        logger.error("Cannot find a deployment token. Aborting.", true);
      } else {
        logger.log(chalk.green(`✔ Successfully setup project!`));

        // store project settings in swa-cli.config.json (if available)
        if (dryRun === false) {
          const currentSwaCliConfig = getCurrentSwaCliConfigFromFile();
          if (currentSwaCliConfig?.config) {
            logger.silly(`Saving project settings to swa-cli.config.json...`);

            const newConfig = { ...currentSwaCliConfig?.config };
            newConfig.appName = staticSiteName;
            newConfig.resourceGroupName = resourceGroupName;
            updateSwaCliConfigFile(newConfig);
          } else {
            logger.silly(`No swa-cli.config.json file found. Skipping saving project settings.`);
          }
        }

        logger.silly("\nDeployment token provided via remote configuration");
        logger.silly({ [chalk.green(`deploymentToken`)]: deploymentToken });
      }
    } catch (error: any) {
      logger.error(error.message);
      return;
    }
  }
  logger.log(`Deploying to environment: ${chalk.green(options.env)}\n`);

  if (printToken) {
    logger.log(`Deployment token:`);
    logger.log(chalk.green(deploymentToken));
    process.exit(0);
  }

  // mix CLI args with the project's build workflow configuration (if any)
  // use any specific workflow config that the user might provide undef ".github/workflows/"
  // Note: CLI args will take precedence over workflow config
  let userWorkflowConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation,
    outputLocation,
    apiLocation,
  };
  try {
    userWorkflowConfig = readWorkflowFile({
      userWorkflowConfig,
    });
  } catch (err) {
    logger.warn(``);
    logger.warn(`Error reading workflow configuration:`);
    logger.warn((err as any).message);
    logger.warn(
      `See https://docs.microsoft.com/azure/static-web-apps/build-configuration?tabs=github-actions#build-configuration for more information.`
    );
  }

  const cliEnv: SWACLIEnv = {
    SWA_CLI_DEBUG: verbose as DebugFilterLevel,
    SWA_RUNTIME_WORKFLOW_LOCATION: userWorkflowConfig?.files?.[0],
    SWA_RUNTIME_CONFIG_LOCATION: swaConfigLocation,
    SWA_RUNTIME_CONFIG: swaConfigLocation ? (await findSWAConfigFile(swaConfigLocation))?.file : undefined,
    SWA_CLI_VERSION: packageInfo.version,
    SWA_CLI_DEPLOY_DRY_RUN: `${dryRun}`,
    SWA_CLI_DEPLOY_BINARY: undefined,
  };

  const deployClientEnv: StaticSiteClientEnv = {
    DEPLOYMENT_ACTION: options.dryRun ? "close" : "upload",
    DEPLOYMENT_PROVIDER: `swa-cli-${packageInfo.version}`,
    REPOSITORY_BASE: appLocation,
    SKIP_APP_BUILD: "true",
    SKIP_API_BUILD: "true",
    DEPLOYMENT_TOKEN: deploymentToken,
    APP_LOCATION: appLocation,
    OUTPUT_LOCATION: outputLocation,
    API_LOCATION: apiLocation,
    VERBOSE: isVerboseEnabled ? "true" : "false",
  };

  // set the DEPLOYMENT_ENVIRONMENT env variable only when the user has provided
  // a deployment environment which is not "production".
  if (options.env !== "production" && options.env !== "prod") {
    deployClientEnv.DEPLOYMENT_ENVIRONMENT = options.env;
  }

  logger.log(`Deploying project to Azure Static Web Apps...`);

  let spinner: ora.Ora = {} as ora.Ora;
  try {
    const { binary, buildId } = await getDeployClientPath();

    if (binary) {
      spinner = ora();
      (cliEnv as any).SWA_CLI_DEPLOY_BINARY = `${binary}@${buildId}`;
      spinner.text = `Deploying using ${cliEnv.SWA_CLI_DEPLOY_BINARY}`;

      logger.silly(`Deploying using the following options:`);
      logger.silly({ env: { ...cliEnv, ...deployClientEnv } });

      spinner.start(`Preparing deployment. Please wait...`);

      const child = spawn(binary, [], {
        env: {
          ...swaCLIEnv(cliEnv, deployClientEnv),
        },
      });

      let projectUrl = "";
      child.stdout!.on("data", (data) => {
        data
          .toString()
          .trim()
          .split("\n")
          .forEach((line: string) => {
            if (line.includes("Exiting")) {
              spinner.text = line;
              spinner.stop();
            } else if (line.includes("Visit your site at:")) {
              projectUrl = line.match("http.*")?.pop()?.trim() as string;
              line = "";
            }

            // catch errors printed to stdout
            else if (line.includes("[31m")) {
              if (line.includes("Cannot deploy to the function app because Function language info isn't provided.")) {
                line = chalk.red(
                  `Cannot deploy to the function app because Function language info isn't provided. Add a "platform.apiRuntime" property to your staticwebapp.config.json file.`
                );
              }

              spinner.fail(chalk.red(line));
            } else {
              if (isVerboseEnabled || dryRun) {
                spinner.info(line.trim());
              } else {
                spinner.text = line.trim();
              }
            }
          });
      });

      child.on("error", (error) => {
        logger.error(error.toString());
      });

      child.on("close", (code) => {
        cleanUp();

        if (code === 0) {
          spinner.succeed(chalk.green(`Project deployed to ${chalk.underline(projectUrl)} 🚀`));
          logger.log(``);
        }
      });
    }
  } catch (error) {
    logger.error("");
    logger.error("Deployment Failed :(");
    logger.error(`Deployment Failure Reason: ${(error as any).message}`);
    logger.error(
      `For further information, please visit the Azure Static Web Apps documentation at https://docs.microsoft.com/azure/static-web-apps/`
    );
    logGiHubIssueMessageAndExit();
  } finally {
    cleanUp();
  }
}
