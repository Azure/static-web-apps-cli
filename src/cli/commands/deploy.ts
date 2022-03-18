import { spawn } from "child_process";
import { logger, registerProcessExit } from "../../core";
import { downloadClient } from "../../core/deploy-client";
import path from "path";

// read package version
const pkg = require(path.join(__dirname, "..", "..", "..", "package.json"));

export async function deploy(deployContext: string, options: SWACLIConfig) {
  if (!options.appOutputLocation) {
    logger.error("--app-output-location option is missing", true);
  }

  if (!options.apiOutputLocation) {
    logger.error("--api-output-location option is missing", true);
  }

  if (!options.deploymentToken) {
    logger.error("--deployment-token option is missing", true);
  }

  try {
    const clientPath = await downloadClient();
    if (clientPath) {
      const env = {
        ...process.env,
        DEPLOYMENT_ACTION: "upload",
        DEPLOYMENT_PROVIDER: `swa-cli-${pkg}`,
        REPOSITORY_BASE: deployContext,
        SKIP_APP_BUILD: "true",
        SKIP_API_BUILD: "true",
        DEPLOYMENT_TOKEN: options.deploymentToken,
        APP_LOCATION: options.appOutputLocation,
        API_LOCATION: options.apiOutputLocation,
      };

      const child = spawn(clientPath, [], {
        stdio: [process.stdin, process.stdout, process.stderr, "pipe"],
        env,
      });

      child.on("exit", (code) => {
        process.exit(code as number);
      });
    }
  } catch (error) {
    logger.error((error as any).message, true);
  }
}
