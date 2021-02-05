#!/usr/bin/env node

import program from "commander";
import { start } from "./commands/start";
import { DEFAULT_CONFIG } from "./config";

(async function () {
  program.name("swa").usage("[options] <command>").version(require("../../package.json").version, "-v, --version");

  // SWA config
  program
    // @TODO don't document --app-location and --app-artifact-location in the readme yet.
    .option("--app-location <appLocation>", "set app folder (location for the application code)", DEFAULT_CONFIG.appLocation)
    .option(
      "--app, --app-artifact-location <appArtifactLocation>",
      "set app artifact folder (location where app files are built for production)",
      DEFAULT_CONFIG.appArtifactLocation
    )
    //

    .option("--api, --api-location <apiLocation>", "set the API folder or URI", DEFAULT_CONFIG.apiLocation)

    // CLI config
    .option("--auth-uri <authUri>", "set Auth uri", `http://localhost:${DEFAULT_CONFIG.authPort}`)
    .option("--api-uri <apiUri>", "set API uri", `http://localhost:${DEFAULT_CONFIG.apiPort}`)
    .option("--app-uri <appUri>", "set APP uri", `http://localhost:${DEFAULT_CONFIG.appPort}`)
    .option("--host <host>", "set emulator host address", DEFAULT_CONFIG.host)
    .option("--port <port>", "set emulator port value", `${DEFAULT_CONFIG.port}`)
    .option("--build", "build the API and APP before starting the emulator", false)
    .option("--verbose", "show debug logs", false);

  program
    .command("start [context]")
    .description("start the emulator from a directory or with a specific port and host address")
    .action(async (context: string = "./") => {
      await start(context, program);
    });

  await program.parseAsync(process.argv);

  if (program.verbose) {
    process.env.DEBUG = "*";
  }
})();
