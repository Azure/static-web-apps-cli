import chalk from "chalk";
import { existsSync, promises as fsPromises } from "fs";
import * as path from "path";
import * as process from "process";
import { DEFAULT_CONFIG } from "../../config";
import { logger } from "./logger";
const { readFile, writeFile } = fsPromises;

export const swaCliConfigSchemaUrl = "https://aka.ms/azure/static-web-apps-cli/schema";
export const swaCliConfigFilename = "swa-cli.config.json";

/**
 * Holds the current configuration of the CLI loaded from the `swa-cli.config.json` file.
 */
let currentSwaCliConfigFromFile: SWACLIConfigInfo | undefined;

export const getCurrentSwaCliConfigFromFile = () => currentSwaCliConfigFromFile;

export const swaCliConfigFileExists = (configFilePath: string) => existsSync(configFilePath);

export async function getConfigFileOptions(
  contextOrConfigEntry: string | undefined,
  configFilePath: string
): Promise<SWACLIConfig & { context?: string }> {
  logger.silly(`Getting config file options from ${configFilePath}...`);

  configFilePath = path.resolve(configFilePath);
  if (!swaCliConfigFileExists(configFilePath)) {
    logger.silly(`Config file does not exist at ${configFilePath}`);
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

  logger.silly(`Changed directory to ${configDir}`);

  if (contextOrConfigEntry === DEFAULT_CONFIG.outputLocation) {
    const hasMultipleConfig = Object.entries(cliConfig.configurations).length > 1;
    if (hasMultipleConfig) {
      // Show as a log not warning because the user may want to use the default config
      logger.log(`Multiple configurations found in "${swaCliConfigFilename}", but none was specified.`);
      logger.log(`Specify which configuration to use with "swa <command> <configurationName>"\n`);
    }

    const [configName, config] = Object.entries(cliConfig.configurations)[0];
    printConfigMsg(configName, configFilePath);
    currentSwaCliConfigFromFile = {
      name: configName,
      filePath: configFilePath,
      config,
    };
    return { ...config };
  } else {
    logger.silly(`Configuration="${contextOrConfigEntry}" does't match outputLocation="${DEFAULT_CONFIG.outputLocation}"`);
  }

  if (contextOrConfigEntry === undefined) {
    logger.warn(`No configuration specified. Ignoring "${swaCliConfigFilename}"`);
    return {};
  }

  const config = cliConfig.configurations?.[contextOrConfigEntry];
  if (config) {
    logger.silly(`Found configuration "${contextOrConfigEntry}" in "${swaCliConfigFilename}"`);

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
  logger.log(chalk.green(`  ${file}`));
  logger.log("");
}

export async function hasConfigurationNameInConfigFile(configFilePath: string, name: string): Promise<boolean> {
  const configJson = await tryParseSwaCliConfig(configFilePath);
  return configJson.configurations?.[name] !== undefined;
}

export async function updateSwaCliConfigFile(config: SWACLIConfig) {
  if (currentSwaCliConfigFromFile === undefined) {
    logger.error("No configuration file currently loaded", true);
  } else {
    logger.silly(`Updating configuration file at ${currentSwaCliConfigFromFile.filePath}`);

    await writeConfigFile(currentSwaCliConfigFromFile.filePath, currentSwaCliConfigFromFile.name, config);
  }
}

export async function writeConfigFile(configFilePath: string, configName: string, config: SWACLIConfig) {
  let configFile: SWACLIConfigFile = {
    // TODO: find node_modules/ path and use local schema if found
    $schema: swaCliConfigSchemaUrl,
    configurations: {},
  };

  if (swaCliConfigFileExists(configFilePath)) {
    logger.silly(`Loading existing swa-cli.config.json file at ${configFilePath}`);

    try {
      const configJson = await readFile(configFilePath, "utf-8");
      configFile = JSON.parse(configJson) as SWACLIConfigFile;
    } catch (error) {
      logger.error(`Error parsing ${configFilePath}`);
      if (error instanceof Error) {
        logger.error(error);
      }
      logger.error("Cannot update existing configuration file.");
      logger.error("Please fix or delete your swa-cli.config.json file and try again.");
      return;
    }
  }

  if (configFile.configurations === undefined) {
    logger.silly(`Creating "configurations" property in swa-cli.config.json file at ${configFilePath}`);
    configFile.configurations = {};
  }

  configFile.configurations[configName] = config;
  try {
    logger.silly(`Writing configuration "${configName}" to swa-cli.config.json`);
    logger.silly(config);

    await writeFile(configFilePath, JSON.stringify(configFile, null, 2));
  } catch (error) {
    logger.error(`Error writing configuration to ${configFilePath}`);
    if (error instanceof Error) {
      logger.error(error);
    }
  }
}
