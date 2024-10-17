import chalk from "chalk";
import os from "os";
import path from "path";
import { logger } from "../../../core/utils/logger.js";
import { readCLIEnvFile } from "../../../core/utils/file.js";
import { ENV_FILENAME } from "../../../core/constants.js";
import { promises as fsPromises } from "fs";
const { writeFile } = fsPromises;

export async function telemetry(options: SWACLIConfig) {
  const { disable, enable, status } = options;

  const config = readCLIEnvFile();
  const captureTelemetryEnv = config["SWA_CLI_CAPTURE_TELEMETRY"];
  const oldEnvFileLines = Object.keys(config).map((key) => `${key}=${config[key]}`);
  const newEnvFileLines = [];

  if ((disable || enable) && !status) {
    //telemetry capturing is enabled by default
    let captureTelemetrySetting = undefined;
    if (disable && !enable) {
      captureTelemetrySetting = "false";
    } else if (!disable && enable) {
      captureTelemetrySetting = "true";
    } else {
      logger.warn("Using the flags --disable and --enable together is not supported!");
    }

    const entry = `SWA_CLI_CAPTURE_TELEMETRY=${captureTelemetrySetting}`;

    if (captureTelemetrySetting) {
      //check if the env file already contains the capture telemetry setting entry
      if (!captureTelemetryEnv) {
        newEnvFileLines.push(entry);
      } else {
        const index = oldEnvFileLines.indexOf(`SWA_CLI_CAPTURE_TELEMETRY=${captureTelemetryEnv}`);
        oldEnvFileLines.splice(index, 1);
        newEnvFileLines.push(entry);
      }
    }

    // write file if we have at least one new env line
    if (newEnvFileLines.length > 0) {
      const envFileContentWithProjectDetails = [...oldEnvFileLines, ...newEnvFileLines].join("\n");
      const swaFolderPath = path.join(os.homedir(), ".swa");
      const envFile = path.join(swaFolderPath, ENV_FILENAME);
      await writeFile(envFile, envFileContentWithProjectDetails);
      logger.log(chalk.green(`✔ Saved Telemetry setting in ${ENV_FILENAME} file at ${swaFolderPath}`));
    }
  } else if (!disable && !enable && status) {
    if (captureTelemetryEnv && captureTelemetryEnv.toLowerCase() === "false") {
      logger.log("Telemetry capturing is disabled.");
    } else if (!captureTelemetryEnv || captureTelemetryEnv.toLowerCase() === "true") {
      logger.log("Telemetry capturing is enabled.");
    }
  } else {
    logger.warn("The flag --status can't be used alongside the flags --disable and --enable!");
  }
}
