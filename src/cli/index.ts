#!/usr/bin/env node

const args = process.argv.slice(2);
process.title = ["swa", ...args].join(" ");

import program from "commander";
import path from "path";
import { DEFAULT_CONFIG } from "../config";
import { parsePort } from "../core/utils";
import { start } from "./commands/start";

(async function () {
  const cli: SWACLIConfig & program.Command = program
    .name("swa")
    .usage("[options] <command>")
    .version(require("../../package.json").version, "-v, --version")

    // SWA config
    .option("--verbose [prefix]", "enable verbose output. Value are: silly,info,log,silent", "log");

  program
    .command("start [context]")
    .description("start the emulator from a directory or bind to a dev server")
    .option("--app-location <appLocation>", "set location for the static app source code", DEFAULT_CONFIG.appLocation)
    .option(
      "--app, --app-artifact-location <appArtifactLocation>",
      "set the location where static files are built for production",
      DEFAULT_CONFIG.appArtifactLocation
    )
    .option("--api, --api-location <apiLocation>", "set the API folder or Azure Functions emulator address", DEFAULT_CONFIG.apiLocation)

    // CLI config
    .option<number>("--api-port <apiPort>", "set the API backend port", parsePort, DEFAULT_CONFIG.apiPort)
    .option("--host <host>", "set the cli host address", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "set the cli port", parsePort, DEFAULT_CONFIG.port)
    .option("--build", "build the app and API before starting the emulator", false)
    .action(async (context: string = `.${path.sep}`, options: any) => {
      options = {
        ...options,
        verbose: cli.verbose,
      };
      await start(context, options);
    });

  await program.parseAsync(process.argv);
})();
