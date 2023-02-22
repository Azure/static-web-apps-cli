import chalk from "chalk";
import os from "os";
import path from "path";
import { logger } from "../../../core";
import { readCLIEnvFile } from "../../../core";
import { ENV_FILENAME } from "../../../core/constants";
import { promises as fsPromises } from "fs";
const { writeFile } = fsPromises;

export async function telemetry(options: SWACLIConfig) {
  const { disable, enable, status } = options;

  const config = await readCLIEnvFile();
  const oldEnvFileLines = Object.keys(config).map((key) => `${key}=${config[key]}`);
  const newEnvFileLines = [];

  if ((disable || enable) && !status) {
    //telemetry capturing is enabled by default
    let disableTelemetryStatus = undefined;
    if (disable) {
      disableTelemetryStatus = "true";
    } else if (disable == undefined && enable) {
      disableTelemetryStatus = "false";
    }

    const entry = `SWA_DISABLE_TELEMETRY=${disableTelemetryStatus}`;

    if (disableTelemetryStatus) {
      if (!config["SWA_DISABLE_TELEMETRY"]) {
        newEnvFileLines.push(entry);
      } else {
        const index = oldEnvFileLines.indexOf(`SWA_DISABLE_TELEMETRY=${config["SWA_DISABLE_TELEMETRY"]}`);
        oldEnvFileLines.splice(index, 1);
        newEnvFileLines.push(entry);
      }
    }

    // write file if we have at least one new env line
    if (newEnvFileLines.length > 0) {
      const envFileContentWithProjectDetails = [...oldEnvFileLines, ...newEnvFileLines].join("\n");
      const envFile = path.join(os.homedir(), ".swa", ENV_FILENAME);
      await writeFile(envFile, envFileContentWithProjectDetails);
      logger.log(chalk.green(`✔ Saved Telemetry setting in ${ENV_FILENAME} file at ${path.join(os.homedir(), ".swa")}`));
    }
  } else if (!disable && !enable && status) {
    if (config["SWA_DISABLE_TELEMETRY"] && config["SWA_DISABLE_TELEMETRY"].toLowerCase() === "true") {
      logger.log("Telemetry capturing is disabled.");
    } else if (!config["SWA_DISABLE_TELEMETRY"] || config["SWA_DISABLE_TELEMETRY"].toLowerCase() === "false") {
      logger.log("Telemetry capturing is enabled.");
    }
  } else {
    logger.warn("The flags --disable and --enable can't be used alongside the flag --status!");
  }
}
