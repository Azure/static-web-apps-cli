import { spawn } from "child_process";
import path from "path";
import ora from "ora";
import { logger } from "../../core";
import { cleanUp, getDeployClientPath } from "../../core/deploy-client";
import chalk from "chalk";

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
    logger.log("Deployment token provide via flag");
  } else if (process.env.SWA_CLI_DEPLOYMENT_TOKEN) {
    deploymentToken = process.env.SWA_CLI_DEPLOYMENT_TOKEN;
    logger.log("Deployment token found in Environment Variables:");
    logger.log({ SWA_CLI_DEPLOYMENT_TOKEN: "<hidden>" });
  }
  logger.log(``);

  // TODO: add support for Azure CLI
  // TODO: add support for Service Principal
  // TODO: check that platform.apiRuntime in staticwebapp.config.json is provided.
  // This is required by the StaticSiteClient!

  const spinner = ora({ text: `Preparing deployment...`, prefixText: chalk.dim.gray(`[swa]`) }).start();
  try {
    const { binary, version } = await getDeployClientPath();
    spinner.text = `Deploying using ${binary}@${version}`;

    if (binary) {
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

      let projectUrl = "";
      const child = spawn(binary, [], { env });

      child.stdout!.on("data", (data) => {
        data
          .toString()
          .trim()
          .split("\n")
          .forEach((line: string) => {
            if (line.includes("Visit your site at:")) {
              projectUrl = line.match("http.*")?.pop()?.trim() as string;
            }

            // catch errors printed to stdout
            else if (line.includes("[31m")) {
              spinner.fail(line);
            }

            if (options.verbose === "silly") {
              spinner.succeed(line.trim());
            } else {
              spinner.text = line.trim();
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
    spinner.stop();
    logger.error((error as any).message, true);
  }
}
