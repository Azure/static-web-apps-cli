import * as path from "path";
import * as process from "process";
import { existsSync, promises as fsPromises } from "fs";
import { logger } from "./logger";
import { DEFAULT_CONFIG } from "../../config";

export const swaCliConfigSchemaUrl = "https://aka.ms/azure/static-web-apps-cli/schema";
export const swaCliConfigFilename = "swa-cli.config.json";
const { readFile, writeFile } = fsPromises;

export const configExists = (configFilePath: string) => existsSync(configFilePath);

export async function getConfigFileOptions(
  contextOrConfigEntry: string | undefined,
  configFilePath: string
): Promise<SWACLIConfig & { context?: string }> {
  configFilePath = path.resolve(configFilePath);
  if (!configExists(configFilePath)) {
    return {};
  }

  const cliConfig = await tryParseSwaCliConfig(configFilePath);
  if (!cliConfig.configurations) {
    logger.warn(`${swaCliConfigFilename} is missing the "configurations" property. No options will be loaded.`);
    return {};
  }

  // Use configuration root path as the directory context
  const configDir = path.dirname(configFilePath);
  process.chdir(configDir);

  if (contextOrConfigEntry === DEFAULT_CONFIG.outputLocation) {
    const hasMultipleConfig = Object.entries(cliConfig.configurations).length > 1;
    if (hasMultipleConfig) {
      // Show as a log not warning because the user may want to use the default config
      logger.log(`Multiple configurations found in "${swaCliConfigFilename}", but none was specified.`);
      logger.log(`Specify which configuration to use with "swa <command> <configurationName>"\n`);
    }

    const [configName, config] = Object.entries(cliConfig.configurations)[0];
    printConfigMsg(configName, configFilePath);
    return { ...config };
  }

  if (contextOrConfigEntry === undefined) {
    return {};
  }

  const config = cliConfig.configurations?.[contextOrConfigEntry];
  if (config) {
    printConfigMsg(contextOrConfigEntry, configFilePath);
    return { ...config };
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
  logger.log(`Using configuration "${name}" from file:`);
  logger.log(`  ${file}`);
  logger.log("");
}

export async function hasConfigurationNameInConfigFile(configFilePath: string, name: string): Promise<boolean> {
  const configJson = await tryParseSwaCliConfig(configFilePath);
  return configJson.configurations?.[name] !== undefined;
}

export async function writeConfigFile(configFilePath: string, projectName: string, config: SWACLIConfig) {
  let configFile: SWACLIConfigFile = {
    // TODO: find node_modules/ path and use local schema if found
    $schema: swaCliConfigSchemaUrl,
    configurations: {},
  };

  if (configExists(configFilePath)) {
    try {
      const configJson = await readFile(configFilePath, "utf-8");
      configFile = JSON.parse(configJson) as SWACLIConfigFile;
    } catch (error) {
      logger.error(`Error parsing ${configFilePath}`);
      if (error instanceof Error) {
        logger.error(error);
      }
      logger.error("Cannot update existing configuration file.");
      logger.error("Please fix or remove your swa-cli.config.json file and try again.");
      return;
    }
  }

  if (configFile.configurations === undefined) {
    configFile.configurations = {};
  }

  configFile.configurations[projectName] = config;
  try {
    await writeFile(configFilePath, JSON.stringify(configFile, null, 2));
  } catch (error) {
    logger.error(`Error writing configuration to ${configFilePath}`);
    if (error instanceof Error) {
      logger.error(error);
    }
  }
}
