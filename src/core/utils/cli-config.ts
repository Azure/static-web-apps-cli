import * as path from "path";
import * as process from "process";
import { defaultStartContext } from "../../cli";
import { fileExists, readFileIfExists, writeFileSafe } from "./fs";
import { logger } from "./logger";

export const swaCliConfigSchemaUrl = "https://aka.ms/azure/static-web-apps-cli/schema";
export const swaCliConfigFilename = "swa-cli.config.json";

export async function getConfigFileOptions(context: string | undefined, configFilePath: string): Promise<SWACLIConfig & { context?: string }> {
  configFilePath = path.resolve(configFilePath);
  if (!fileExists(configFilePath)) {
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

  if (context === defaultStartContext) {
    const hasMultipleConfig = Object.entries(cliConfig.configurations).length > 1;
    if (hasMultipleConfig) {
      logger.log(`Multiple configurations found in "${swaCliConfigFilename}", but none was specified.`);
      logger.log(`Specify which configuration to use with "swa <command> <configurationName>"\n`);
    }

    const [configName, config] = Object.entries(cliConfig.configurations)[0];
    printConfigMsg(configName, configFilePath);
    return { ...config };
  }

  if (context === undefined) {
    return {};
  }

  const config = cliConfig.configurations?.[context];
  if (config) {
    printConfigMsg(context, configFilePath);
    return { ...config };
  }

  return {};
}

async function tryParseSwaCliConfig(file: string) {
  try {
    return JSON.parse((await readFileIfExists(file)) || "") as SWACLIConfigFile;
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
  logger.log(`\t${file}`);
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

  try {
    const configJson = await readFileIfExists(configFilePath);
    configFile = JSON.parse(configJson || "") as SWACLIConfigFile;
  } catch (error) {
    logger.error(`Error parsing ${configFilePath}`);
    if (error instanceof Error) {
      logger.error(error);
    }
    logger.error("Cannot update existing configuration file.");
    logger.error("Please fix or remove your swa-cli.config.json file and try again.");
    return;
  }

  if (configFile.configurations === undefined) {
    configFile.configurations = {};
  }

  configFile.configurations[projectName] = config;
  try {
    await writeFileSafe(configFilePath, JSON.stringify(configFile, null, 2));
  } catch (error) {
    logger.error(`Error writing configuration to ${configFilePath}`);
    if (error instanceof Error) {
      logger.error(error);
    }
  }
}
