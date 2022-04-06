import { Command, OptionValues } from "commander";
import { DEFAULT_CONFIG } from "../../config";
import { getConfigFileOptions } from "./cli-config";
import { logger } from "./logger";

export async function configureOptions(
  context: string | undefined,
  options: SWACLIConfig,
  command: Command
): Promise<{ context: string | undefined; options: SWACLIConfig }> {
  const verbose = options.verbose;

  // TODO: we cannot use swaCLIEnv() here!
  process.env.SWA_CLI_DEBUG = verbose;

  if (verbose?.includes("silly")) {
    // When silly level is set,
    // propagate debugging level to other tools using the DEBUG environment variable

    // TODO: we cannot use swaCLIEnv() here!
    process.env.DEBUG = "*";
  }

  const userOptions = getUserOptions(command);
  const configFileOptions = await getConfigFileOptions(context, options.config!);

  options = {
    ...options,
    ...configFileOptions,
    ...userOptions,
  };

  if (options.printConfig) {
    logger.log("", "swa");
    logger.log("Options: ", "swa");
    logger.log({ ...DEFAULT_CONFIG, ...options }, "swa");
  }

  return {
    context: configFileOptions.context ?? context,
    options,
  };
}

function getUserOptions(command: Command) {
  const userOptions: OptionValues = {};
  const options = command.opts();
  for (const option in options) {
    if (command.getOptionValueSource(option) !== "default") {
      userOptions[option] = options[option];
    }
  }
  return userOptions as SWACLIConfig;
}
