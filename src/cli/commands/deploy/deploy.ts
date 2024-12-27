import chalk from "chalk";
import { spawn } from "node:child_process";
import fs from "node:fs";
import ora, { Ora } from "ora";
import path from "node:path";
import { findSWAConfigFile } from "../../../core/utils/user-config.js";
import { getCurrentSwaCliConfigFromFile, updateSwaCliConfigFile } from "../../../core/utils/cli-config.js";
import { logger, logGitHubIssueMessageAndExit } from "../../../core/utils/logger.js";
import { isUserOrConfigOption } from "../../../core/utils/options.js";
import { readWorkflowFile } from "../../../core/utils/workflow-config.js";
import { chooseOrCreateProjectDetails, getStaticSiteDeployment } from "../../../core/account.js";
import { DEFAULT_RUNTIME_LANGUAGE, TELEMETRY_EVENTS, TELEMETRY_RESPONSE_TYPES } from "../../../core/constants.js";
import { cleanUp, getDeployClientPath } from "../../../core/deploy-client.js";
import { swaCLIEnv } from "../../../core/env.js";
import { getDefaultVersion } from "../../../core/functions-versions.js";
import { login } from "../login/login.js";
import { loadPackageJson } from "../../../core/utils/json.js";
import { collectTelemetryEvent } from "../../../core/telemetry/utils.js";

const packageInfo = loadPackageJson();

export async function deploy(options: SWACLIConfig) {
  const startTime = new Date().getTime();
  const { SWA_CLI_DEPLOYMENT_TOKEN, SWA_CLI_DEBUG } = swaCLIEnv();
  const isVerboseEnabled = SWA_CLI_DEBUG === "silly";

  let {
    appLocation,
    apiLocation,
    dataApiLocation,
    outputLocation,
    dryRun,
    deploymentToken,
    printToken,
    appName,
    swaConfigLocation,
    verbose,
    apiLanguage,
    apiVersion,
  } = options;

  if (dryRun) {
    logger.warn("***********************************************************************");
    logger.warn("* WARNING: Running in dry run mode. This project will not be deployed *");
    logger.warn("***********************************************************************");
    logger.warn("");
  }

  // make sure appLocation is set
  appLocation = path.resolve(appLocation || process.cwd());

  // make sure dataApiLocation is set
  if (dataApiLocation) {
    dataApiLocation = path.resolve(dataApiLocation);
    if (!fs.existsSync(dataApiLocation)) {
      logger.error(`The provided Data API folder ${dataApiLocation} does not exist. Abort.`, true);
      const endTime = new Date().getTime();
      await collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
        duration: (endTime - startTime).toString(),
        responseType: TELEMETRY_RESPONSE_TYPES.Failure,
        errorMessage: "Data API folder does not exist",
      });
      return;
    } else {
      logger.log(`Deploying Data API from folder:`);
      logger.log(`  ${chalk.green(dataApiLocation)}`);
      logger.log(``);
    }
  }

  logger.silly(`Resolving outputLocation=${outputLocation} full path...`);
  let resolvedOutputLocation = path.resolve(appLocation, outputLocation as string);

  // if folder exists, deploy from a specific build folder (outputLocation), relative to appLocation
  if (!fs.existsSync(resolvedOutputLocation)) {
    if (!fs.existsSync(outputLocation as string)) {
      logger.error(`The folder "${resolvedOutputLocation}" is not found. Exit.`, true);
      const endTime = new Date().getTime();
      await collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
        duration: (endTime - startTime).toString(),
        responseType: TELEMETRY_RESPONSE_TYPES.Failure,
        errorMessage: "Output location does not exist",
      });
      return;
    }
    // otherwise, build folder (outputLocation) is using the absolute location
    resolvedOutputLocation = path.resolve(outputLocation as string);
  }

  logger.log(`Deploying front-end files from folder:`);
  logger.log(`  ${chalk.green(resolvedOutputLocation)}`);
  logger.log(``);

  // if --api-location is provided, use it as the api folder
  let resolvedApiLocation = undefined;
  if (apiLocation) {
    resolvedApiLocation = path.resolve(apiLocation!);
    if (!fs.existsSync(resolvedApiLocation)) {
      logger.error(`The provided API folder ${resolvedApiLocation} does not exist. Abort.`, true);
      const endTime = new Date().getTime();
      await collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
        duration: (endTime - startTime).toString(),
        responseType: TELEMETRY_RESPONSE_TYPES.Failure,
        errorMessage: "API folder does not exist",
      });
      return;
    } else {
      logger.log(`Deploying API from folder:`);
      logger.log(`  ${chalk.green(resolvedApiLocation)}`);
      logger.log(``);
    }
  } else {
    // otherwise, check if the default api folder exists and print a warning
    const apiFolder = await findApiFolderInPath(appLocation);
    if (apiFolder) {
      logger.warn(
        `An API folder was found at ".${
          path.sep + path.basename(apiFolder)
        }" but the --api-location option was not provided. The API will not be deployed.\n`,
      );
    }
  }

  if (!isUserOrConfigOption("apiLanguage")) {
    logger.log(`Consider providing api-language and version using --api-language and --api-version flags,
    otherwise default values apiLanguage: ${apiLanguage} and apiVersion: ${apiVersion} will apply`);
  } else if (!isUserOrConfigOption("apiVersion")) {
    if (!apiLanguage) {
      apiLanguage = DEFAULT_RUNTIME_LANGUAGE;
    }
    apiVersion = getDefaultVersion(apiLanguage);
    logger.log(`Api language "${apiLanguage}" is provided but api version is not provided.
      Assuming default version "${apiVersion}"`);
  }

  // resolve the deployment token
  if (deploymentToken) {
    deploymentToken = deploymentToken;
    logger.silly("Deployment token provided via flag");
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

      const { resourceGroup, staticSiteName } = (await chooseOrCreateProjectDetails(options, credentialChain, subscriptionId, printToken)) as {
        resourceGroup: string;
        staticSiteName: string;
      };

      logger.silly(`Project settings:`);
      logger.silly({
        resourceGroup,
        staticSiteName,
        subscriptionId,
      });

      const deploymentTokenResponse = await getStaticSiteDeployment(
        credentialChain,
        subscriptionId,
        resourceGroup as string,
        staticSiteName as string,
      );

      deploymentToken = deploymentTokenResponse?.properties?.apiKey;

      if (!deploymentToken) {
        logger.error("Cannot find a deployment token. Aborting.", true);
        const endTime = new Date().getTime();
        await collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
          duration: (endTime - startTime).toString(),
          responseType: TELEMETRY_RESPONSE_TYPES.Failure,
          errorMessage: "Deployment token not found",
        });
      } else {
        logger.log(chalk.green(`✔ Successfully setup project!`));

        // store project settings in swa-cli.config.json (if available)
        if (dryRun === false) {
          const currentSwaCliConfig = getCurrentSwaCliConfigFromFile();
          if (currentSwaCliConfig?.config) {
            logger.silly(`Saving project settings to swa-cli.config.json...`);

            const newConfig = { ...currentSwaCliConfig?.config };
            newConfig.appName = staticSiteName;
            newConfig.resourceGroup = resourceGroup;
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
      const endTime = new Date().getTime();
      await collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
        duration: (endTime - startTime).toString(),
        responseType: TELEMETRY_RESPONSE_TYPES.Failure,
        errorMessage: "Deployment token not found",
      });
      return;
    }
  }
  logger.log(`\nDeploying to environment: ${chalk.green(options.env)}\n`);

  if (printToken) {
    logger.log(`Deployment token:`);
    logger.log(chalk.green(deploymentToken));
    process.exit(0);
  }

  // TODO: do that in options
  // mix CLI args with the project's build workflow configuration (if any)
  // use any specific workflow config that the user might provide under ".github/workflows/"
  // Note: CLI args will take precedence over workflow config
  let userWorkflowConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation,
    outputLocation: resolvedOutputLocation,
    apiLocation: resolvedApiLocation,
    dataApiLocation,
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
      `See https://docs.microsoft.com/azure/static-web-apps/build-configuration?tabs=github-actions#build-configuration for more information.`,
    );
  }

  swaConfigLocation = swaConfigLocation || userWorkflowConfig?.appLocation;
  const swaConfigFilePath = (await findSWAConfigFile(swaConfigLocation!))?.filepath;
  const resolvedSwaConfigLocation = swaConfigFilePath ? path.dirname(swaConfigFilePath) : undefined;

  const cliEnv: SWACLIEnv = {
    SWA_CLI_DEBUG: verbose as DebugFilterLevel,
    SWA_RUNTIME_WORKFLOW_LOCATION: userWorkflowConfig?.files?.[0],
    SWA_RUNTIME_CONFIG_LOCATION: resolvedSwaConfigLocation,
    SWA_RUNTIME_CONFIG: swaConfigFilePath,
    SWA_CLI_VERSION: packageInfo.version,
    SWA_CLI_DEPLOY_DRY_RUN: `${dryRun}`,
    SWA_CLI_DEPLOY_BINARY: undefined,
  };

  const deployClientEnv: StaticSiteClientEnv = {
    DEPLOYMENT_ACTION: options.dryRun ? "close" : "upload",
    DEPLOYMENT_PROVIDER: "SwaCli",
    REPOSITORY_BASE: userWorkflowConfig?.appLocation,
    SKIP_APP_BUILD: "true",
    SKIP_API_BUILD: "true",
    DEPLOYMENT_TOKEN: deploymentToken,
    // /!\ Static site client doesn't use OUTPUT_LOCATION at all if SKIP_APP_BUILD is set,
    // so you need to provide the output path as the app location
    APP_LOCATION: userWorkflowConfig?.outputLocation,
    // OUTPUT_LOCATION: outputLocation,
    API_LOCATION: userWorkflowConfig?.apiLocation,
    DATA_API_LOCATION: userWorkflowConfig?.dataApiLocation,
    // If config file is not in output location, we need to tell where to find it
    CONFIG_FILE_LOCATION: resolvedSwaConfigLocation,
    VERBOSE: isVerboseEnabled ? "true" : "false",
    FUNCTION_LANGUAGE: apiLanguage,
    FUNCTION_LANGUAGE_VERSION: apiVersion,
  };

  // set the DEPLOYMENT_ENVIRONMENT env variable only when the user has provided
  // a deployment environment which is not "production".
  if (options.env?.toLowerCase() !== "production" && options.env?.toLowerCase() !== "prod") {
    deployClientEnv.DEPLOYMENT_ENVIRONMENT = options.env;
  }

  logger.log(`Deploying project to Azure Static Web Apps...`);

  let spinner: Ora = {} as Ora;
  try {
    const { binary, buildId } = await getDeployClientPath();

    if (binary) {
      spinner = ora();
      (cliEnv as any).SWA_CLI_DEPLOY_BINARY = `${binary}@${buildId}`;
      spinner.text = `Deploying using ${cliEnv.SWA_CLI_DEPLOY_BINARY}`;

      logger.silly(`Deploying using ${cliEnv.SWA_CLI_DEPLOY_BINARY}`);
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
                  `Cannot deploy to the function app because Function language info isn't provided, use flags "--api-language" and "--api-version" or add a "platform.apiRuntime" property to your staticwebapp.config.json file, or create one in ${options.outputLocation!}. Please consult the documentation for more information about staticwebapp.config.json: https://learn.microsoft.com/azure/static-web-apps/build-configuration?tabs=github-actions#skip-building-the-api`,
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
        const endTime = new Date().getTime();
        collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
          duration: (endTime - startTime).toString(),
          responseType: TELEMETRY_RESPONSE_TYPES.Failure,
          errorMessage: error.toString(),
        });
      });

      child.on("close", (code) => {
        cleanUp();

        if (code === 0) {
          spinner.succeed(chalk.green(`Project deployed to ${chalk.underline(projectUrl)} 🚀`));
          logger.log(``);
          const endTime = new Date().getTime();
          collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
            duration: (endTime - startTime).toString(),
            responseType: TELEMETRY_RESPONSE_TYPES.Success,
          });
        }
      });
    }
  } catch (error) {
    logger.error("");
    logger.error("Deployment Failed :(");
    logger.error(`Deployment Failure Reason: ${(error as any).message}`);
    logger.error(
      `For further information, please visit the Azure Static Web Apps documentation at https://docs.microsoft.com/azure/static-web-apps/`,
    );
    const endTime = new Date().getTime();
    await collectTelemetryEvent(TELEMETRY_EVENTS.Deploy, {
      duration: (endTime - startTime).toString(),
      responseType: TELEMETRY_RESPONSE_TYPES.Failure,
      errorMessage: (error as any).message,
    });
    logGitHubIssueMessageAndExit();
  } finally {
    cleanUp();
  }
}

async function findApiFolderInPath(appPath: string): Promise<string | undefined> {
  const entries = await fs.promises.readdir(appPath, { withFileTypes: true });
  return entries.find((entry) => entry.name.toLowerCase() === "api" && entry.isDirectory())?.name;
}
