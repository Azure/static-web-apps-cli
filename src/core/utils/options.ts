import { Command, OptionValues, program } from "commander";
import { DEFAULT_CONFIG } from "../../config";
import { SWACommand, SWA_COMMANDS } from "../constants";
import { getConfigFileOptions } from "./cli-config";
import { logger } from "./logger";

export async function configureOptions(
  outputLocationOrConfigEntry: string | undefined,
  options: SWACLIConfig,
  command: Command,
  commandName: SWACommand
): Promise<{ options: SWACLIConfig }> {
  const verbose = options.verbose;

  setLogLevel(verbose);

  const userOptions = getUserOptions(command);
  const configFileOptions = await getConfigFileOptions(outputLocationOrConfigEntry, options.config!);
  const configFileCommandSpecificOptions = commandName ? configFileOptions[commandName] || {} : {};

  // Clean up subcommands overrides before merging
  // to avoid confusing the user when printing options
  SWA_COMMANDS.forEach((command) => { delete configFileOptions[command]; });

  options = {
    ...options,
    ...configFileOptions,
    ...configFileCommandSpecificOptions,
    ...userOptions,
  };

  // Re-set log level again after config file has been read,
  // as it may have changed the log level
  setLogLevel(options.verbose);

  if (options.printConfig) {
    logger.log("\nOptions: ");
    logger.log({ ...DEFAULT_CONFIG, ...options });
  }

  return {
    options,
  };
}

function setLogLevel(verbosity: string | undefined) {
  process.env.SWA_CLI_DEBUG = verbosity;

  if (verbosity?.includes("silly")) {
    // When silly level is set,
    // propagate debugging level to other tools using the DEBUG environment variable
    process.env.DEBUG = "*";
  }
}

function getUserOptions(command: Command) {
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
