#!/usr/bin/env node

const [, , ...args] = process.argv;
process.title = ["swa", ...args].join(" ");

import program from "commander";
import { parsePort } from "../core/utils";
import { start } from "./commands/start";
import { DEFAULT_CONFIG } from "../config";

(async function () {
  const cli: CLIConfig & program.Command = program
    .name("swa")
    .usage("[options] <command>")
    .version(require("../../package.json").version, "-v, --version")

    // SWA config
    .option("--app-location <appLocation>", "set app folder (location for the application code)", DEFAULT_CONFIG.appLocation)
    .option(
      "--app, --app-artifact-location <appArtifactLocation>",
      "set app artifact folder (location where app files are built for production)",
      DEFAULT_CONFIG.appArtifactLocation
    )
    .option("--api, --api-location <apiLocation>", "set the API folder or URI", DEFAULT_CONFIG.apiLocation)

    // CLI config
    .option<number>("--auth-port <authPort>", "set the authentication server port", parsePort, DEFAULT_CONFIG.authPort)
    .option<number>("--api-port <apiPort>", "set the API backend port", parsePort, DEFAULT_CONFIG.apiPort)
    .option<number>("--app-port <appPort>", "set the static server port", parsePort, DEFAULT_CONFIG.appPort)
    .option("--host <host>", "set the cli host address", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "set the cli port", parsePort, DEFAULT_CONFIG.port)
    .option("--build", "build the API and APP before starting the emulator", false)
    .option("--verbose", "show debug logs", false);

  program
    .command("start [context]")
    .description("start the emulator from a directory or with a specific port and host address")
    .action(async (context: string = "./") => {
      await start(context, cli);
    });

  await program.parseAsync(process.argv);

  if (program.verbose) {
    process.env.DEBUG = "*";
  }
})();
