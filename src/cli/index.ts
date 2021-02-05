#!/usr/bin/env node

import program from "commander";
import { start } from "./commands/start";
import { DEFAULT_CONFIG } from "./config";

(async function () {
  program.name("swa").usage("[options] <command>").version(require("../../package.json").version, "-v, --version");

  // SWA config
  program
    .option("--app-location <appLocation>", "set app folder (location for the application code)", DEFAULT_CONFIG.appLocation)
    .option(
      "--app-artifact-location <appArtifactLocation>",
      "set app artifact folder (location where app files are built for production)",
      DEFAULT_CONFIG.appArtifactLocation
    )
    .option("--api, --api-location <apiLocation>", "set the API folder", DEFAULT_CONFIG.apiLocation)

    // Emulator config
    .option("--auth-uri <authUri>", "set Auth uri", `http://localhost:${DEFAULT_CONFIG.authPort}`)
    .option("--api-uri <apiUri>", "set API uri", `http://localhost:${DEFAULT_CONFIG.apiPort}`)
    .option("--api-prefix <apiPrefix>", "set API prefix", DEFAULT_CONFIG.apiPrefix)
    .option("--app-uri <appUri>", "set APP uri", `http://localhost:${DEFAULT_CONFIG.appPort}`)
    .option("--use-api <useApi>", "Use running API dev server", undefined)
    .option("--use-app <useApp>", "Use running APP dev server", undefined)
    .option("--host <host>", "set emulator host address", DEFAULT_CONFIG.host)
    .option("--port <port>", "set emulator port value", `${DEFAULT_CONFIG.port}`)
    .option("--build", "build the API and APP before starting the emulator", false)
    .option("--verbose", "show debug logs", false)
    .option("--ui", "enable dashboard UI", false);

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
