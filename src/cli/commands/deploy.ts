import { spawn } from "child_process";
import path from "path";
import { logger } from "../../core";
import { cleanUp, getDeployClientPath } from "../../core/deploy-client";

const pkg = require(path.join(__dirname, "..", "..", "..", "package.json"));

export async function deploy(deployContext: string, options: SWACLIConfig) {
  if (!options.outputLocation) {
    logger.error("--output-location option is missing", true);
  }

  if (!options.apiLocation) {
    logger.error("--api-location option is missing", true);
  }

  let deploymentToken = "";
  if (options.deploymentToken) {
    deploymentToken = options.deploymentToken;
    logger.log("Deployment token provide via flag", "deploy");
  } else if (process.env.SWA_CLI_DEPLOYMENT_TOKEN) {
    deploymentToken = process.env.SWA_CLI_DEPLOYMENT_TOKEN;
    logger.log("Deployment token found in env: SWA_CLI_DEPLOYMENT_TOKEN=<hidden>", "deploy");
  }
  // TODO: add support for Azure CLI
  // TODO: add support for Service Principal
  // TODO: check that platform.apiRuntime in staticwebapp.config.json is provided.
  // This is required by the StaticSiteClient!

  try {
    const clientPath = await getDeployClientPath();
    logger.log(`Deploying using ${clientPath}`, "deploy");

    if (clientPath) {
      const env = {
        ...process.env,
        DEPLOYMENT_ACTION: "upload",
        DEPLOYMENT_PROVIDER: `swa-cli-${pkg.version}`,
        REPOSITORY_BASE: deployContext,
        SKIP_APP_BUILD: "true",
        SKIP_API_BUILD: "true",
        DEPLOYMENT_TOKEN: deploymentToken,
        APP_LOCATION: options.outputLocation,
        API_LOCATION: options.apiLocation,
        VERBOSE: options.verbose === "silly" ? "true" : "false",
      };

      const child = spawn(clientPath, [], {
        env,
      });

      child.stdout!.on("data", (data) => {
        data
          .toString()
          .trim()
          .split("\n")
          .forEach((line: string) => {
            logger.log(line.trim(), "deploy");
          });
      });

      child.stderr!.on("data", (data) => {
        logger.warn(data.toString(), "deploy");
      });

      child.on("error", (error) => {
        logger.error(error.toString());
      });

      child.on("close", (code) => {
        cleanUp();
        if (code === 0) {
          logger.log("Deployment completed successfully", "deploy");
        } else {
          logger.error(`Deployment failed with exit code ${code}`, true);
        }
      });
    }
  } catch (error) {
    logger.error((error as any).message, true);
  }
}
