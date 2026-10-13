import chalk from "chalk";
import { existsSync, promises as fsPromises, readFileSync, realpathSync, statSync } from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { logger } from "./logger.js";
import { ExecutableExclusion } from "./executable.js";
const { readFile, writeFile } = fsPromises;

export const swaCliConfigSchemaUrl = "https://aka.ms/azure/static-web-apps-cli/schema";
export const swaCliConfigFilename = "swa-cli.config.json";

/**
 * Holds the current configuration of the CLI loaded from the `swa-cli.config.json` file.
 */
let currentSwaCliConfigFromFile: SWACLIConfigInfo | undefined;
const invocationCwd = process.cwd();

function projectMarker(file: string) {
  try {
    return statSync(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

function evidencedRoot(location: string, hasMarker: (directory: string) => boolean): string | undefined {
  let directory = path.resolve(location);
  while (true) {
    try {
      directory = realpathSync(directory);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
    }
    if (hasMarker(directory)) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function repositoryRoot(location: string): string | undefined {
  return evidencedRoot(location, (directory) => {
    const marker = path.join(directory, ".git");
    const stat = projectMarker(marker);
    return stat?.isDirectory() === true || (stat?.isFile() === true && /^gitdir:\s+\S/.test(readFileSync(marker, "utf8")));
  });
}

function isProjectDirectory(directory: string): boolean {
  return [swaCliConfigFilename, "package.json"].some((name) => {
    const marker = path.join(directory, name);
    return projectMarker(marker)?.isFile();
  });
}

/** Carry exact invocation/search directories separately from genuine recursive project roots. */
export function getProjectRoots(options: SWACLIConfig, locations: readonly (string | undefined)[] = []): ExecutableExclusion[] {
  const cwd = process.cwd();
  const configPath = currentSwaCliConfigFromFile?.filePath ?? options.config;
  const resolvedConfig = configPath ? path.resolve(invocationCwd, configPath) : undefined;
  const roots = [
    ...(resolvedConfig && (currentSwaCliConfigFromFile || projectMarker(resolvedConfig)?.isFile()) ? [path.dirname(resolvedConfig)] : []),
    options.appLocation,
    options.apiLocation,
    options.dataApiLocation,
    options.swaConfigLocation,
    ...locations,
  ];
  const projectRoots = new Set(roots.filter((root): root is string => !!root && !/^https?:\/\//i.test(root)).map((root) => path.resolve(root)));
  const searchDirectories = [...new Set([invocationCwd, cwd].map((directory) => path.resolve(directory)))];
  for (const directory of searchDirectories) {
    const project = evidencedRoot(directory, isProjectDirectory);
    if (project) projectRoots.add(project);
  }
  for (const location of [...projectRoots, ...searchDirectories]) {
    const repo = repositoryRoot(location);
    if (repo) projectRoots.add(repo);
  }
  return [...projectRoots, ...searchDirectories.map((directory) => ({ directory }))];
}

/**
 * Get the current configuration of the CLI stored in `{@link currentSwaCliConfigFromFile}`.
 *
 * @returns The current configuration of the CLI loaded from the `swa-cli.config.json` file.
 */
export const getCurrentSwaCliConfigFromFile = () => currentSwaCliConfigFromFile;
export const setCurrentSwaCliConfigFromFile = (config: SWACLIConfigInfo | undefined) => (currentSwaCliConfigFromFile = config);

/**
 * Checks if the given configuration file exists.
 *
 * @param configFilePath The path to the config file.
 * @returns True if the config file exists. False otherwise.
 */
export const swaCliConfigFileExists = (configFilePath: string) => existsSync(configFilePath);

/**
 * Checks if the specified value match the loaded configuration name.
 *
 * @param name The name to check.
 * @returns True if the config loaded matches the name, false otherwise.
 */
export function matchLoadedConfigName(name: string) {
  const configName = currentSwaCliConfigFromFile?.name;
  return configName && configName === name;
}

/**
 * Loads the configuration from the `swa-cli.config.json` file (if available).
 *
 * @param configName The name of the configuration to load.
 * @param configFilePath The path to the `swa-cli.config.json` file.
 * @returns An object with the `{@link SWACLIOptions}` config or an empty object if the config file, or the config entry were not found.
 */
export async function getConfigFileOptions(configName: string | undefined, configFilePath: string): Promise<SWACLIConfig> {
  logger.silly(`Getting config file options from "${configFilePath}"...`);

  let configFilePathResolved = path.resolve(configFilePath);
  if (!swaCliConfigFileExists(configFilePathResolved)) {
    logger.silly(`Config file does not exist at "${configFilePath}"`);

    // Handle the case when the user runs the command outside the project path
    if (!configName || !swaCliConfigFileExists(path.resolve(configName, swaCliConfigFilename))) {
      return {};
    }
    logger.warn(
      `WARNING: Config file does not exist at "${configFilePath}", but can be detected at "${path.join(
        configName,
        swaCliConfigFilename
      )}". Do you mean "swa --config ${path.join(configName, swaCliConfigFilename)} <command> ${configName} [options]"?`
    );
    configFilePathResolved = path.resolve(configName, swaCliConfigFilename);
  }

  const cliConfig = await tryParseSwaCliConfig(configFilePathResolved);
  if (!cliConfig.configurations) {
    logger.warn(`${swaCliConfigFilename} is missing the "configurations" property. No options will be loaded.`);
    return {};
  }

  // Use configuration root path as the outputLocation
  const configDir = path.dirname(configFilePathResolved);
  process.chdir(configDir);

  logger.silly(`Changed directory to ${configDir}`);

  if (!configName) {
    const hasMultipleConfig = Object.entries(cliConfig.configurations).length > 1;
    if (hasMultipleConfig) {
      // Show as a log not warning because the user may want to use the default config
      logger.log(`Multiple configurations found in "${swaCliConfigFilename}", but none was specified.`);
      logger.log(`Specify which configuration to use with "swa <command> --config-name <configName>"\n`);
    }

    const [configName, config] = Object.entries(cliConfig.configurations)[0];
    printConfigMsg(configName, configFilePathResolved);
    currentSwaCliConfigFromFile = {
      name: configName,
      filePath: configFilePathResolved,
      config,
    };
    return { ...config };
  }

  const config = cliConfig.configurations?.[configName];
  if (config) {
    logger.silly(`Found configuration "${configName}" in "${swaCliConfigFilename}"`);

    printConfigMsg(configName, configFilePath);
    currentSwaCliConfigFromFile = {
      name: configName,
      filePath: configFilePath,
      config,
    };
    return { ...config };
  }

  return {};
}

/**
 * Parse the `swa-cli.config.json` file and return the parsed object.
 *
 * @param configFilePath The path to the `swa-cli.config.json` file.
 * @returns The parsed `swa-cli.config.json` file.
 * @throws If the file cannot be parsed.
 */
async function tryParseSwaCliConfig(configFilePath: string) {
  try {
    return JSON.parse((await readFile(configFilePath)).toString("utf-8")) as SWACLIConfigFile;
  } catch (e) {
    logger.error(`Error parsing swa-cli.config.json file at ${configFilePath}`);
    if (e instanceof Error) {
      logger.error(e);
    }
    return {};
  }
}

/**
 * Prints a message to the console indicating which configuration was used.
 *
 * @param name The name of the configuration.
 * @param configFilePath The path to the `swa-cli.config.json` file.
 */
function printConfigMsg(name: string, configFilePath: string) {
  if (!process.env.SWA_CLI_INTERNAL_COMMAND) {
    logger.log(`Using configuration "${name}" from file:`);
    logger.log(chalk.green(`  ${configFilePath}`));
    logger.log("");
  }
}

/**
 * Checks if the config file contains a configuration entry with the given name.
 * @param configFilePath The path to the `swa-cli.config.json` file.
 * @param name The name of the configuration entry.
 * @returns True if the config file contains a configuration entry with the given name. False otherwise.
 */
export async function hasConfigurationNameInConfigFile(configFilePath: string, name: string): Promise<boolean> {
  const configJson = await tryParseSwaCliConfig(configFilePath);
  return configJson.configurations?.[name] !== undefined;
}

/**
 * Writes the current configuration ({@link currentSwaCliConfigFromFile}) to the `swa-cli.config.json` file.
 *
 * @param config The configuration object to save.
 */
export async function updateSwaCliConfigFile(config: SWACLIConfig) {
  const currentSwaCliConfigFromFile = getCurrentSwaCliConfigFromFile();
  if (currentSwaCliConfigFromFile === undefined) {
    logger.error("No configuration file currently loaded", true);
  } else {
    logger.silly(`Updating configuration file at ${currentSwaCliConfigFromFile.filePath}`);

    await writeConfigFile(currentSwaCliConfigFromFile.filePath, currentSwaCliConfigFromFile.name, config);
  }
}

/**
 * Appends or update the given configuration entry to the `swa-cli.config.json` file.
 *
 * @param configFilePath The path to the `swa-cli.config.json` file.
 * @param configName The name of the configuration entry to be added or updated.
 * @param config The configuration object to save.
 */
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

  if (typeof configFile !== "object" || configFile.constructor !== Object) {
    logger.error(`Error parsing ${configFilePath}`);
    logger.error("Invalid configuration content found.");
    logger.error("Please fix or delete your swa-cli.config.json file and try again.");
    return;
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
