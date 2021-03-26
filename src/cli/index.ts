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
      "--app, --app-artifact-location <outputLocation>",
      "set the location of the build output directory relative to the --app-location.",
      DEFAULT_CONFIG.outputLocation
    )
    .option("--api, --api-location <apiLocation>", "set the API folder or Azure Functions emulator address", DEFAULT_CONFIG.apiLocation)

    // CLI config
    .option<number>("--api-port <apiPort>", "set the API backend port", parsePort, DEFAULT_CONFIG.apiPort)
    .option("--host <host>", "set the cli host address", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "set the cli port", parsePort, DEFAULT_CONFIG.port)
    .option("--build", "build the app and API before starting the emulator", false)
    .option("--ssl", "serving the app and API over HTTPS", DEFAULT_CONFIG.ssl)
    .option("--ssl-cert <sslCertLocation>", "SSL certificate to use for serving HTTPS", DEFAULT_CONFIG.sslCert)
    .option("--ssl-key <sslKeyLocation>", "SSL key to use for serving HTTPS", DEFAULT_CONFIG.sslKey)

    .option("--run <startupScript>", "run a external program or npm/yarn script on startup", DEFAULT_CONFIG.run)

    .action(async (context: string = `.${path.sep}`, options: SWACLIConfig) => {
      options = {
        ...options,
        verbose: cli.verbose,
      };

      // make sure the start command gets the right verbosity level
      process.env.SWA_CLI_DEBUG = options.verbose;
      if (options.verbose?.includes("silly")) {
        // when silly level is set,
        // propagate debugging level to other tools using the DEBUG environment variable
        process.env.DEBUG = "*";
      }

      await start(context, options);
    });

  await program.parseAsync(process.argv);
})();
