#!/usr/bin/env node

const shell = require("shelljs");
const path = require("path");
const program = require("commander");
const builder = require("./builder");
const { readConfigFile } = require("./utils");

program
  .name("swa")
  .usage("<command>")
  .version(require("../package.json").version)
  .option("--auth-uri <authUri>", "set Auth uri", "http://localhost:4242")
  .option("--api-uri <apiUri>", "set API uri", "http://localhost:7071")
  .option("--api-prefix <apiPrefix>", "set API prefix", "api")
  .option("--app-uri <appUri>", "set APP uri", "http://localhost:4200")
  .option("--host <host>", "set host address", "0.0.0.0")
  .option("--port <port>", "set port value", 80)
  .option("--debug", "set port value", false)
  .option("--build", "build the API and APP before starting the emulator", false)
  .parse(process.argv);

if (program.debug) {
  process.env.DEBUG = "*";
}

// parse the Auth URI port or default to 4242
const authUriPort = program.authUri.split(":").map(Number)[2] || 4242;

// parse the APP URI port or default to 4200
const appUriSegments = program.appUri.split(":");
const appUriPort = appUriSegments[2] || 4200;
const appUriAddress = (appUriSegments[1] || "localhost").replace("//", "");

// provide binaries
const concurrentlyBin = path.resolve(__dirname, "..", "./node_modules/.bin/concurrently");
const httpServerBin = path.resolve(__dirname, "..", "./node_modules/.bin/http-server");
const { app_artifact_location, api_location } = readConfigFile();

if (program.build) {
  // run the app/api builds
  builder();
}

const startCommand = [
  // set env vars for current command
  "StaticWebAppsAuthCookie=123",
  "StaticWebAppsAuthContextCookie=abc",
  "AppServiceAuthSession=1a2b3c",
  `DEBUG=${program.debug ? "*" : ""}`,

  // use the default dev token
  `GITHUB_CLIENT_ID=`,
  `GITHUB_CLIENT_SECRET=`,

  `SWA_EMU_AUTH_URI="${program.authUri}"`,
  `SWA_EMU_API_URI="${program.apiUri}"`,
  `SWA_EMU_API_PREFIX="${program.apiPrefix}"`,
  `SWA_EMU_APP_URI="${program.appUri}"`,
  `SWA_EMU_HOST="${program.host}"`,
  `SWA_EMU_PORT="${program.port}"`,

  // run concurrent commands
  concurrentlyBin,
  `--restart-tries 1`,
  `--names msha,auth,app,api`,
  `-c 'bgYellow.bold,bgMagenta.bold,bgCyan.bold.bgCyanBright.bold'`,
  `--kill-others`,

  // start msha
  `'npm:msha'`,

  // emulate auth
  `'npm:auth -- --port=${authUriPort} --cors=*'`,

  // serve the app
  // See available options for http-server: https://github.com/http-party/http-server#available-options
  // Note: the --proxy options allows http-server to work with SPA routing.
  `"${httpServerBin} ${app_artifact_location} -p ${appUriPort} -c-1 --proxy http://localhost:${appUriPort}?"`,

  // serve the api
  `"(cd ${api_location}; func start)"`,
  `--color=always`,
];

if (process.env.DEBUG) {
  console.log(startCommand);
}

shell.exec(
  startCommand.join(" "),
  {
    // set the cwd to the installation folder
    cwd: path.resolve(__dirname, ".."),
  },
  (code, stdout, stderr) => {
    if (stderr.length) {
      console.error(stderr);
    }
  }
);
