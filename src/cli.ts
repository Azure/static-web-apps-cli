#!/usr/bin/env node

import shell from "shelljs";
import path from "path";
import program from "commander";
import builder from "./builder";
import { readConfigFile } from "./utils";
import { spawn } from "child_process";
import { createRuntimeHost } from "./runtimeHost";
import { dashboard } from "./dashboard";

const EMU_PORT = "80";
const AUTH_PORT = 4242;
const API_PORT = 7071;
const APP_PORT = 4200;

program
  .name("swa")
  .usage("<command>")
  .version(require("../package.json").version)
  .option("--auth-uri <authUri>", "set Auth uri", `http://localhost:${AUTH_PORT}`)
  .option("--api-uri <apiUri>", "set API uri", `http://localhost:${API_PORT}`)
  .option("--api-prefix <apiPrefix>", "set API prefix", "api")
  .option("--app-uri <appUri>", "set APP uri", `http://localhost:${APP_PORT}`)
  .option("--use-api <useApi>", "Use running API dev server", undefined)
  .option("--use-app <useApp>", "Use running APP dev server", undefined)
  .option("--host <host>", "set emulator host address", "0.0.0.0")
  .option("--port <port>", "set emulator port value", EMU_PORT)
  .option("--build", "build the API and APP before starting the emulator", false)
  .option("--verbose", "show debug logs", false)
  .option("--ui", "enable dashboard UI", false)
  .parse(process.argv);

if (program.verbose) {
  process.env.DEBUG = "*";
}

// parse the Auth URI port or default to 4242
const authUriPort = program.authUri.split(":").map(Number)[2] || AUTH_PORT;

// parse the APP URI port or default to 4200
const appUriSegments = program.appUri.split(":");
const appUriPort = appUriSegments[2] || APP_PORT;

// provide binaries
const concurrentlyBin = path.resolve(__dirname, "..", "./node_modules/.bin/concurrently");
const { app_artifact_location, api_location } = readConfigFile();

const envVarsObj = {
  // set env vars for current command
  StaticWebAppsAuthCookie: "123",
  StaticWebAppsAuthContextCookie: "abc",
  AppServiceAuthSession: "1a2b3c",
  DEBUG: program.debug ? "*" : "",

  // use the default dev token
  GITHUB_CLIENT_ID: "",
  GITHUB_CLIENT_SECRET: "",
  SWA_EMU_AUTH_URI: program.authUri,
  SWA_EMU_API_URI: program.useApi || program.apiUri,
  SWA_EMU_API_PREFIX: program.apiPrefix,
  SWA_EMU_APP_URI: program.useApp || program.appUri,
  SWA_EMU_APP_LOCATION: app_artifact_location,
  SWA_EMU_HOST: program.host,
  SWA_EMU_PORT: program.port,
};

const { command: hostCommand, args: hostArgs } = createRuntimeHost(appUriPort, program.host, program.port);

let serveApiContent = `[ -d '${api_location}' ] && (cd ${api_location}; func start --cors *) || echo 'No API found. Skipping.'`;
if (program.useApi) {
  serveApiContent = `echo 'using API dev server at ${program.useApi}'`;
}

let serveStaticContent = `${hostCommand} ${hostArgs.join(" ")}`;
if (program.useApp) {
  serveStaticContent = `echo 'using APP dev server at ${program.useApp}'`;
}

const startCommand = [
  // run concurrent commands
  concurrentlyBin,
  `--restart-tries 3`,
  `--names emulator,auth,hosting,functions`,
  `-c 'bgYellow.bold,bgMagenta.bold,bgCyan.bold,bgGreen.bold'`,

  // start the reverse proxy
  `"node ./dist/proxy.js"`,

  // emulate auth
  `"(cd ./dist/auth/; func start --cors=* --port=${authUriPort})"`,

  // serve the app
  `"${serveStaticContent}"`,

  // serve the api, if it's available
  `"${serveApiContent}"`,

  `--color=always`,
];

if (process.env.DEBUG) {
  console.log(startCommand);
}

if (program.build) {
  // run the app/api builds
  builder();
}

if (program.ui) {
  // print the dashboard UI

  const spawnx = (command: string, args: string[]) =>
    spawn(`${command}`, args, {
      shell: true,
      env: { ...process.env, ...envVarsObj },
      cwd: path.resolve(__dirname, ".."),
    });

  // start hosting
  const hosting = spawnx(hostCommand, hostArgs);
  dashboard.stream("hosting", hosting);

  // start functions
  const functions = spawnx(`[ -d '${api_location}' ] && (cd ${api_location}; func start --cors *) || echo 'No API found. Skipping.'`, []);
  dashboard.stream("functions", functions);

  // start auth
  const auth = spawnx(`(cd ./dist/auth/; func start --cors=* --port=${authUriPort})`, []);
  dashboard.stream("auth", auth);

  // start proxy
  const status = spawnx(`node`, [`./dist/proxy`]);
  dashboard.stream("status", status);

  process.on("exit", () => {
    process.exit(process.pid);
  });
} else {
  // run concurrent commands
  shell.exec(
    startCommand.join(" "),
    {
      // set the cwd to the installation folder
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, ...envVarsObj },
    },
    (_code, _stdout, stderr) => {
      if (stderr.length) {
        console.error(stderr);
      }
    }
  );
}
