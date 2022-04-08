import chalk from "chalk";
import { spawn } from "child_process";
import { Command } from "commander";
import fs from "fs";
import ora from "ora";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { configureOptions, findSWAConfigFile, logger, readWorkflowFile } from "../../core";
import { getStaticSiteDeployment } from "../../core/account";
import { cleanUp, getDeployClientPath } from "../../core/deploy-client";
import { swaCLIEnv } from "../../core/env";
import { login } from "./login";

const packageInfo = require(path.join(__dirname, "..", "..", "..", "package.json"));

export default function registerCommand(program: Command) {
  program
    .command("deploy [context]")
    .usage("[context] [options]")
    .description("Deploy the current project to Azure Static Web Apps")
    .option("--api-location <apiLocation>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("--deployment-token <secret>", "the secret token used to authenticate with the Static Web Apps")
    .option("--dry-run", "simulate a deploy process without actually running it", DEFAULT_CONFIG.dryRun)
    .action(async (context: string = `.${path.sep}`, _options: SWACLIConfig, command: Command) => {
      const config = await configureOptions(context, command.optsWithGlobals(), command);
      await deploy(config.context ?? context, config.options);
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
    `
    );
}

export async function deploy(deployContext: string, options: SWACLIConfig) {
  const { SWA_CLI_DEPLOYMENT_TOKEN, SWA_CLI_DEBUG } = swaCLIEnv();
  const isVerboseEnabled = SWA_CLI_DEBUG === "silly";

  if (options.dryRun) {
    logger.warn("***********************************************************************");
    logger.warn("* WARNING: Running in dry run mode. This project will not be deployed *");
    logger.warn("***********************************************************************");
    logger.warn("");
  }

  const frontendFolder = path.resolve(process.cwd(), deployContext);
  logger.log(`Deploying front-end files from folder:`);
  logger.log(`  ${chalk.green(frontendFolder)}`);
  logger.log(``);

  // if --api-location is provided, use it as the api folder
  if (options.apiLocation) {
    const userApiFolder = path.resolve(process.cwd(), options.apiLocation!);
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
    const defaultApiFolder = path.resolve(process.cwd(), DEFAULT_CONFIG.apiPrefix!);
    if (fs.existsSync(defaultApiFolder)) {
      logger.warn(
        `An API folder was found at ".${
          path.sep + DEFAULT_CONFIG.apiPrefix!
        }" but the --api-location option was not provided. API will not be deployed!`,
        "swa"
      );
    }
  }

  let deploymentToken: string | undefined = undefined;
  if (options.deploymentToken) {
    deploymentToken = options.deploymentToken;
    logger.log("Deployment token provide via flag");
    logger.log({ [chalk.green(`--deployment-token`)]: options.deploymentToken });
  } else if (SWA_CLI_DEPLOYMENT_TOKEN) {
    deploymentToken = SWA_CLI_DEPLOYMENT_TOKEN;
    logger.log("Deployment token found in Environment Variables:");
    logger.log({ [chalk.green(`SWA_CLI_DEPLOYMENT_TOKEN`)]: SWA_CLI_DEPLOYMENT_TOKEN });
  } else if (options.dryRun === false) {
    logger.warn(`No deployment token found. Trying interactive login...`);

    try {
      const { credentialChain, subscriptionId, resourceGroupName, staticSiteName } = await login({
        ...options,
        persist: true,
      });

      const deploymentTokenResponse = await getStaticSiteDeployment(credentialChain, subscriptionId, resourceGroupName, staticSiteName);

      deploymentToken = deploymentTokenResponse?.properties?.apiKey;

      if (!deploymentToken) {
        throw new Error("Cannot find a deployment token. Aborting.");
      }

      logger.log("Deployment token provided via remote config");
      logger.log({ [chalk.green(`deploymentToken`)]: deploymentToken });
    } catch {
      logger.error("A deployment token is required to deploy to Azure Static Web Apps");
      logger.error("Provide a deployment token using the --deployment-token option or SWA_CLI_DEPLOYMENT_TOKEN environment variable", true);
      return;
    }
  }
  logger.log(``);

  let userWorkflowConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation: options.appLocation,
    outputLocation: options.outputLocation,
    apiLocation: options.apiLocation,
  };

  // mix CLI args with the project's build workflow configuration (if any)
  // use any specific workflow config that the user might provide undef ".github/workflows/"
  // Note: CLI args will take precedence over workflow config
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
    SWA_CLI_DEBUG: options.verbose as DebugFilterLevel,
    SWA_RUNTIME_WORKFLOW_LOCATION: `${userWorkflowConfig?.files?.[0]}`,
    SWA_RUNTIME_CONFIG_LOCATION: options.swaConfigLocation,
    SWA_RUNTIME_CONFIG: options.swaConfigLocation ? (await findSWAConfigFile(options.swaConfigLocation))?.file : undefined,
    SWA_CLI_VERSION: packageInfo.version,
    SWA_CLI_DEPLOY_DRY_RUN: `${options.dryRun}`,
    SWA_CLI_DEPLOY_BINARY: undefined,
  };

  const deployClientEnv: SWACLIEnv = {
    DEPLOYMENT_ACTION: options.dryRun ? "close" : "upload",
    DEPLOYMENT_PROVIDER: `swa-cli-${packageInfo.version}`,
    REPOSITORY_BASE: deployContext,
    SKIP_APP_BUILD: "true",
    SKIP_API_BUILD: "true",
    DEPLOYMENT_TOKEN: deploymentToken,
    APP_LOCATION: deployContext,
    OUTPUT_LOCATION: options.outputLocation,
    API_LOCATION: options.apiLocation,
    VERBOSE: isVerboseEnabled ? "true" : "false",
  };

  let spinner: ora.Ora = {} as ora.Ora;
  try {
    const { binary, version } = await getDeployClientPath();

    if (binary) {
      spinner = ora();
      (cliEnv as any).SWA_CLI_DEPLOY_BINARY = `${binary}@${version}`;
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
              if (isVerboseEnabled || options.dryRun) {
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
          spinner.succeed(chalk.green(`Deployed to ${projectUrl}`));
        }
      });
    }
  } catch (error) {
    logger.error("");
    logger.error("Deployment Failed :(");
    logger.error(`Deployment Failure Reason: ${(error as any).message}`);
    logger.error(
      `For further information, please visit the Azure Static Web Apps documentation at https://docs.microsoft.com/en-us/azure/static-web-apps/`
    );
    logger.error("If you believe this behavior is unexpected, please raise a GitHub issue at https://github.com/azure/static-web-apps-cli/issues/");
    logger.error("Exiting", true);
  } finally {
    cleanUp();
  }
}
