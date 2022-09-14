import { Command, OptionValues, program } from "commander";
import { DEFAULT_CONFIG } from "../../config";
import { SWACommand, SWA_COMMANDS } from "../constants";
import { getConfigFileOptions } from "./cli-config";
import { logger } from "./logger";

let userDefinedOptions: SWACLIConfig = {};
let configFileDefinedOptions: SWACLIConfig = {};

export async function configureOptions(
  configName: string | undefined,
  options: SWACLIConfig,
  command: Command,
  commandName: SWACommand,
  loadConfigFile: boolean = true
): Promise<SWACLIConfig> {
  const verbose = options.verbose;

  setLogLevel(verbose);

  userDefinedOptions = getUserOptions(command);
  const configFileOptions = loadConfigFile ? await getConfigFileOptions(options.configName || configName, options.config!) : {};
  const configFileCommandSpecificOptions = commandName ? configFileOptions[commandName] || {} : {};

  // Clean up subcommands overrides before merging
  // to avoid confusing the user when printing options
  SWA_COMMANDS.forEach((command) => {
    delete configFileOptions[command];
  });
  configFileDefinedOptions = { ...configFileOptions, ...configFileCommandSpecificOptions };

  options = {
    ...options,
    ...configFileDefinedOptions,
    ...userDefinedOptions,
  };

  // Re-set log level again after config file has been read,
  // as it may have changed the log level
  setLogLevel(options.verbose);

  if (options.printConfig) {
    logger.log("\nOptions: ");
    logger.log({ ...DEFAULT_CONFIG, ...options });
  }

  return options;
}

function setLogLevel(verbosity: string | undefined) {
  process.env.SWA_CLI_DEBUG = verbosity;

  if (verbosity?.includes("silly")) {
    // When silly level is set,
    // propagate debugging level to other tools using the DEBUG environment variable
    process.env.DEBUG = "*";
  }
}

export function getUserOptions(command: Command) {
  const userOptions: OptionValues = {};
  const options = command.optsWithGlobals();

  for (const option in options) {
    // If the option is not found in the command context, it returns undefined
    // meaning that we have to find its source in the global context.
    const source = command.getOptionValueSource(option) || program.getOptionValueSource(option);

    if (source === "cli") {
      userOptions[option] = options[option as keyof SWACLIConfig];
    }
  }
  return userOptions as SWACLIConfig;
}

export function isUserOption(option: keyof SWACLIConfig): boolean {
  return userDefinedOptions[option] !== undefined;
}

export function isConfigFileOption(option: keyof SWACLIConfig): boolean {
  return configFileDefinedOptions[option] !== undefined;
}

export function isUserOrConfigOption(option: keyof SWACLIConfig): boolean {
  return isUserOption(option) || isConfigFileOption(option);
}
