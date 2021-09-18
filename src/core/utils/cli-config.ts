import * as path from "path";
import fs, { promises as fsPromises } from "fs";
import { logger } from "./logger";
import { defaultStartContext } from "../../cli";
const { readFile } = fsPromises;

export const swaCliConfigFilename = "swa-cli.config.json";

export async function getFileOptions(context: string, configFilePath: string): Promise<SWACLIConfig & { context?: string }> {
  if (!fs.existsSync(configFilePath)) {
    return {};
  }

  const cliConfig = await tryParseSwaCliConfig(configFilePath);
  if (!cliConfig.configurations) {
    logger.warn(`${swaCliConfigFilename} is missing the "configurations" property. No options will be loaded.`);
    return {};
  }

  const hasOnlyOneConfig = Object.entries(cliConfig.configurations).length === 1;
  if (hasOnlyOneConfig && context === defaultStartContext) {
    const [configName, config] = Object.entries(cliConfig.configurations)[0];
    printConfigMsg(configName, configFilePath);
    return { context: `.${path.sep}`, ...config };
  }

  const config = cliConfig.configurations?.[context];
  if (config) {
    printConfigMsg(context, configFilePath);
    return { context: `.${path.sep}`, ...config };
  }

  return {};
}

async function tryParseSwaCliConfig(file: string) {
  try {
    return JSON.parse((await readFile(file)).toString("utf-8")) as SWACLIConfigFile;
  } catch (e) {
    logger.error(`Error parsing swa-cli.config.json file at ${file}`);
    if (e instanceof Error) {
      logger.error(e);
    }
    return {};
  }
}

function printConfigMsg(name: string, file: string) {
  logger.log(`Using configuration "${name}" from file:`, "swa");
  logger.log(`\t${path.resolve(process.cwd(), file)}`, "swa");
  logger.log("", "swa");
  logger.log(`Options passed in via CLI will be overridden by options in file.`, "swa");
}
