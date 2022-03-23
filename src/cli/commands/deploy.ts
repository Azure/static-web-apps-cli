import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import ora from "ora";
import { logger, readWorkflowFile } from "../../core";
import { cleanUp, getDeployClientPath } from "../../core/deploy-client";
import chalk from "chalk";
import { DEFAULT_CONFIG } from "../../config";

const packageInfo = require(path.join(__dirname, "..", "..", "..", "package.json"));

export async function deploy(deployContext: string, options: SWACLIConfig) {
  const { SWA_CLI_DEPLOYMENT_TOKEN, SWA_CLI_DEBUG } = process.env;
  const isVerboseEnabled = SWA_CLI_DEBUG === "silly";

  if (options.dryRun) {
    logger.warn("", "swa");
    logger.warn("WARNING: Running in dry run mode. This project will not be deployed!", "swa");
  }

  const apiFolder = path.resolve(process.cwd(), DEFAULT_CONFIG.apiPrefix!);
  if (!options.apiLocation && fs.existsSync(apiFolder)) {
    logger.warn(`An API folder was found at ".${path.sep + DEFAULT_CONFIG.apiPrefix!}" but the --api-location option was not provided`, "swa");
  }

  let deploymentToken = "";
  if (options.deploymentToken) {
    deploymentToken = options.deploymentToken;
    logger.log("Deployment token provide via flag", "swa");
    logger.log({ SWA_CLI_DEPLOYMENT_TOKEN: options.deploymentToken }, "swa");
  } else if (SWA_CLI_DEPLOYMENT_TOKEN) {
    deploymentToken = SWA_CLI_DEPLOYMENT_TOKEN;
    logger.log("Deployment token found in Environment Variables:", "swa");
    logger.log({ SWA_CLI_DEPLOYMENT_TOKEN }, "swa");
  } else {
    logger.error("The --deployment-token option is missing", true);
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
                line =
                  line +
                  ` Add a "platform.apiRuntime" property in your staticwebapp.config.json file. See https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#platform`;
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
