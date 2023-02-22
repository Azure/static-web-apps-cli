import { Command } from "commander";
import process from "process";
import { configureOptions, isUserOption, logger } from "../../../core/utils";
import { init } from "./init";

export default function registerCommand(program: Command) {
  program
    .command("init [configName]")
    .usage("[configName] [options]")
    .description("initialize a new static web app project")
    .option("-y, --yes", "answer yes to all prompts (disable interactive mode)", false)
    .action(async (configName: string | undefined, _options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(undefined, command.optsWithGlobals(), command, "init", false);
      if (configName) {
        if (isUserOption("configName")) {
          logger.error(`swa init <configName> cannot be used when --config-name option is also set.`);
          logger.error(`You either have to use the positional argument or option, not both at the same time.`, true);
        }

        options.configName = configName;
      }

      await init(options, !process.env.SWA_CLI_INTERNAL_COMMAND);
    });
}
