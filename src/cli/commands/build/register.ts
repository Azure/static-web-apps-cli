import { Command } from "commander";
import { DEFAULT_CONFIG } from "../../../config.js";
import { configureOptions, isUserOption } from "../../../core/utils/options.js";
import { matchLoadedConfigName } from "../../../core/utils/cli-config.js";
import { logger } from "../../../core/utils/logger.js";
import { build } from "./build.js";

export default function registerCommand(program: Command) {
  program
    .command("build [configName|appLocation]")
    .usage("[configName|appLocation] [options]")
    .description("build your project")
    .option("-a, --app-location <path>", "the folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("-i, --api-location <path>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("-O, --output-location <path>", "the folder containing the built source of the front-end application", DEFAULT_CONFIG.outputLocation)
    .option("-A, --app-build-command <command>", "the command used to build your app", DEFAULT_CONFIG.appBuildCommand)
    .option("-I, --api-build-command <command>", "the command used to build your api", DEFAULT_CONFIG.apiBuildCommand)
    .option("--auto", "automatically detect how to build your app and api", false)
    .action(async (positionalArg: string | undefined, _options: SWACLIConfig, command: Command) => {
      positionalArg = positionalArg?.trim();
      const options = await configureOptions(positionalArg, command.optsWithGlobals(), command, "build");
      if (positionalArg && !matchLoadedConfigName(positionalArg)) {
        if (isUserOption("appLocation")) {
          logger.error(`swa build <appLocation> cannot be when with --app-location option is also set.`);
          logger.error(`You either have to use the positional argument or option, not both at the same time.`, true);
        }

        // If it's not the config name, then it's the app location
        options.appLocation = positionalArg;
      }

      await build(options);
    });
}
