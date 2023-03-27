import { Command } from "commander";
import { DEFAULT_CONFIG } from "../../../config";
import { configureOptions, isUserOption, logger, matchLoadedConfigName } from "../../../core";
import { addSharedLoginOptionsToCommand } from "../login";
import { deploy } from "./deploy";

export default function registerCommand(program: Command) {
  const deployCommand = program
    .command("deploy [configName|outputLocation]")
    .usage("[configName|outputLocation] [options]")
    .description("deploy the current project to Azure Static Web Apps")
    .option("-a, --app-location <path>", "the folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("-i, --api-location <path>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("-da, --data-api-location <path>", "the folder containing the database connections configuration", DEFAULT_CONFIG.dataApiLocation)
    .option("-O, --output-location <path>", "the folder containing the built source of the front-end application", DEFAULT_CONFIG.outputLocation)
    .option("-al, --api-language <apiLanguage>", "the runtime language of the function/api", DEFAULT_CONFIG.apiLanguage)
    .option("-av, --api-version <apiVersion>", "the version of the function runtime language", DEFAULT_CONFIG.apiVersion)
    .option(
      "-w, --swa-config-location <swaConfigLocation>",
      "the directory where the staticwebapp.config.json file is located",
      DEFAULT_CONFIG.swaConfigLocation
    )
    .option("-d, --deployment-token <secret>", "the secret token used to authenticate with the Static Web Apps")
    .option("-dr, --dry-run", "simulate a deploy process without actually running it", DEFAULT_CONFIG.dryRun)
    .option("-pt, --print-token", "print the deployment token", false)
    .option("--env [environment]", "the type of deployment environment where to deploy the project", DEFAULT_CONFIG.env)
    .action(async (positionalArg: string | undefined, _options: SWACLIConfig, command: Command) => {
      positionalArg = positionalArg?.trim();
      const options = await configureOptions(positionalArg, command.optsWithGlobals(), command, "deploy");
      if (positionalArg && !matchLoadedConfigName(positionalArg)) {
        if (isUserOption("outputLocation")) {
          logger.error(`swa deploy <outputLocation> cannot be used when --output-location option is also set.`);
          logger.error(`You either have to use the positional argument or option, not both at the same time.`, true);
        }

        // If it's not the config name, then it's the output location
        options.outputLocation = positionalArg;
      }

      await deploy(options);
    })
    .addHelpText(
      "after",
      `
Examples:

  Deploy using a deployment token
  swa deploy ./dist/ --api-location ./api/ --deployment-token <token>

  Deploy using a deployment token from env
  SWA_CLI_DEPLOYMENT_TOKEN=123 swa deploy ./dist/ --api-location ./api/

  Provide function language and version
  swa deploy ./my-dist --api-location ./api --api-language "node" --api-version "16"

  Deploy using swa-cli.config.json file
  swa deploy
  swa deploy myconfig

  Print the deployment token
  swa deploy --print-token

  Deploy to a specific environment
  swa deploy --env production
    `
    );
  addSharedLoginOptionsToCommand(deployCommand);
}
