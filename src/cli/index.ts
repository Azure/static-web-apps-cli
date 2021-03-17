#!/usr/bin/env node

const args = process.argv.slice(2);
process.title = ["swa", ...args].join(" ");

import program from "commander";
import path from "path";
import { parsePort } from "../core/utils";
import { start } from "./commands/start";
import { DEFAULT_CONFIG } from "../config";

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
    .option("--app-location <appLocation>", "set app folder (location for the application code)", DEFAULT_CONFIG.appLocation)
    .option(
      "--app, --app-artifact-location <appArtifactLocation>",
      "set app artifact folder (location where app files are built for production)",
      DEFAULT_CONFIG.appArtifactLocation
    )
    .option("--api, --api-location <apiLocation>", "set the API folder or URI", DEFAULT_CONFIG.apiLocation)

    // CLI config
    .option<number>("--api-port <apiPort>", "set the API backend port", parsePort, DEFAULT_CONFIG.apiPort)
    .option("--host <host>", "set the cli host address", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "set the cli port", parsePort, DEFAULT_CONFIG.port)
    .option("--build", "build the API and APP before starting the emulator", false)
    .action(async (context: string = `.${path.sep}`, options: any) => {
      options = {
        ...options,
        verbose: cli.verbose,
      };
      await start(context, options);
    });

  await program.parseAsync(process.argv);
})();
