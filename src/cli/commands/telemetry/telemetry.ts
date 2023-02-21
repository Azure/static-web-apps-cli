import chalk from "chalk";
import dotenv from "dotenv";
import os from "os";
import path from "path";
import { logger } from "../../../core";
import { ENV_FILENAME } from "../../../core/constants";
import { existsSync, promises as fsPromises } from "fs";
const { readFile, writeFile } = fsPromises;

export async function telemetry(options: SWACLIConfig) {
  const { disable, enable, status } = options;
  const envFile = path.join(os.homedir(), ".swa", ENV_FILENAME);
  const envFileExists = existsSync(envFile);
  const envFileContent = envFileExists ? await readFile(envFile, "utf8") : "";
  const buf = Buffer.from(envFileContent);

  // in case the .env file format changes in the future, we can use the following to parse the file
  const config = dotenv.parse(buf);
  const oldEnvFileLines = Object.keys(config).map((key) => `${key}=${config[key]}`);
  const newEnvFileLines = [];

  if ((disable || enable) && !status) {
    //telemetry capturing is enabled by default
    let disableTelemetryStatus = "false";
    if (disable && enable == undefined) {
      disableTelemetryStatus = "true";
    } else if (disable == undefined && enable) {
      disableTelemetryStatus = "false";
    } else {
      logger.warn("The flags --disable and --enable can't be used at the same time!");
    }

    const entry = `SWA_DISABLE_TELEMETRY=${disableTelemetryStatus}`;

    if (!envFileContent.includes("SWA_DISABLE_TELEMETRY")) {
      newEnvFileLines.push(entry);
    } else {
      const index = oldEnvFileLines.indexOf(`SWA_DISABLE_TELEMETRY=${config["SWA_DISABLE_TELEMETRY"]}`);
      oldEnvFileLines.splice(index, 1);
      newEnvFileLines.push(entry);
    }

    // write file if we have at least one new env line
    if (newEnvFileLines.length > 0) {
      const envFileContentWithProjectDetails = [...oldEnvFileLines, ...newEnvFileLines].join("\n");
      await writeFile(envFile, envFileContentWithProjectDetails);
      logger.log(chalk.green(`✔ Saved Telemetry setting in ${ENV_FILENAME} file at ${path.join(os.homedir(), ".swa")}`));
    }
  } else if (!disable && !enable && status) {
    if (config["SWA_DISABLE_TELEMETRY"] == "true") {
      logger.log("Telemetry capturing is disabled.");
    } else {
      logger.log("Telemetry capturing is enabled.");
    }
  }
}
