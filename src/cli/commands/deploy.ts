import chalk from "chalk";
import { spawn } from "child_process";
import fs from "fs";
import ora from "ora";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { findSWAConfigFile, logger, readWorkflowFile } from "../../core";
import { cleanUp, getDeployClientPath } from "../../core/deploy-client";

const packageInfo = require(path.join(__dirname, "..", "..", "..", "package.json"));

export async function deploy(deployContext: string, options: SWACLIConfig) {
  const { SWA_CLI_DEPLOYMENT_TOKEN, SWA_CLI_DEBUG } = process.env;
  const isVerboseEnabled = SWA_CLI_DEBUG === "silly";

  if (options.dryRun) {
    logger.warn("", "swa");
    logger.warn("WARNING: Running in dry run mode. This project will not be deployed!", "swa");
  }

  if (options.outputLocation) {
    const outputFolder = path.resolve(process.cwd(), options.outputLocation);
    logger.log(`Deploying front-end files from folder:`, "swa");
    logger.log(`  ${chalk.green(outputFolder)}`, "swa");
    logger.log(``, "swa");
  }

  const apiFolder = path.resolve(process.cwd(), DEFAULT_CONFIG.apiPrefix!);
  if (!options.apiLocation) {
    if (fs.existsSync(apiFolder)) {
      logger.warn(
        `An API folder was found at ".${
          path.sep + DEFAULT_CONFIG.apiPrefix!
        }" but the --api-location option was not provided. API will not be deployed!`,
        "swa"
      );
    } else {
      logger.warn(`No API found. Skipping...`, "swa");
    }
  } else {
    logger.log(`Deploying API from folder:`, "swa");
    logger.log(`  ${chalk.green(apiFolder)}`, "swa");
    logger.log(``, "swa");
  }

  let deploymentToken = "";
  if (options.deploymentToken) {
    deploymentToken = options.deploymentToken;
    logger.log("Deployment token provide via flag", "swa");
    logger.log({ [chalk.green(`--deployment-token`)]: options.deploymentToken }, "swa");
  } else if (SWA_CLI_DEPLOYMENT_TOKEN) {
    deploymentToken = SWA_CLI_DEPLOYMENT_TOKEN;
    logger.log("Deployment token found in Environment Variables:", "swa");
    logger.log({ [chalk.green(`SWA_CLI_DEPLOYMENT_TOKEN`)]: SWA_CLI_DEPLOYMENT_TOKEN }, "swa");
  } else {
    logger.error("A deployment token is required to deploy to Azure Static Web Apps");
    logger.error("Provide a deployment token using the --deployment-token option or SWA_CLI_DEPLOYMENT_TOKEN environment variable", true);
    return;
  }
  logger.log(``, "swa");

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
      `See https://docs.microsoft.com/azure/static-web-apps/build-configuration?tabs=github-actions#build-configuration for more information.`,
      "swa"
    );
  }

  const cliEnv = {
    SWA_CLI_DEBUG: options.verbose,
    SWA_CLI_ROUTES_LOCATION: options.swaConfigLocation,
    SWA_WORKFLOW_FILES: userWorkflowConfig?.files?.join(","),
    SWA_RUNTIME_CONFIG: options.swaConfigLocation ? (await findSWAConfigFile(options.swaConfigLocation))?.file : undefined,
    SWA_CLI_VERSION: packageInfo.version,
    SWA_CLI_DEPLOY_DRY_RUN: `${options.dryRun}`,
    SWA_CLI_DEPLOY_BINARY: undefined,
  };

  const deployClientEnv = {
    DEPLOYMENT_ACTION: options.dryRun ? "close" : "upload",
    DEPLOYMENT_PROVIDER: `swa-cli-${packageInfo.version}`,
    REPOSITORY_BASE: deployContext,
    SKIP_APP_BUILD: "true",
    SKIP_API_BUILD: "true",
    DEPLOYMENT_TOKEN: deploymentToken,
    APP_LOCATION: options.outputLocation,
    API_LOCATION: options.apiLocation,
    VERBOSE: isVerboseEnabled ? "true" : "false",
  };

  // TODO: add support for .env file
  // TODO: add support for Azure CLI
  // TODO: add support for Service Principal
  // TODO: check that platform.apiRuntime in staticwebapp.config.json is provided.
  //       This is required by the StaticSiteClient!

  let spinner: ora.Ora = {} as ora.Ora;
  try {
    const { binary, version } = await getDeployClientPath();

    if (binary) {
      spinner = ora({ prefixText: chalk.dim.gray(`[swa]`) });
      (cliEnv as any).SWA_CLI_DEPLOY_BINARY = `${binary}@${version}`;
      spinner.text = `Deploying using ${cliEnv.SWA_CLI_DEPLOY_BINARY}`;

      logger.silly(`Deploying using the following options:`, "swa");
      logger.silly({ env: { ...cliEnv, ...deployClientEnv } }, "swa");

      spinner.start(`Preparing deployment...`);

      const child = spawn(binary, [], {
        env: {
          ...process.env,
          ...cliEnv,
          ...deployClientEnv,
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
    logger.error((error as any).message, true);
  } finally {
    cleanUp();
  }
}
