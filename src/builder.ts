import fs from "fs";
import path from "path";
import shell from "shelljs";
import { readConfigFile } from "./utils";
import { detectRuntime, RuntimeType } from "./runtimes";

const exec = (command, options = {}) => shell.exec(command, { async: false, ...options });

// use the concurrently binary provided by this emulator
const concurrentlyBin = path.resolve(__dirname, "..", "./node_modules/.bin/concurrently");

const nodeBuilder = (location, buildCommand, name, colour) => {
  const appBuildCommand = [
    "CI=1",
    concurrentlyBin,
    `--names ${name}`,
    `-c '${colour}'`,
    `--kill-others-on-fail`,
    `"npm install && ${buildCommand}"`,
    `--color=always`,
  ].join(" ");
  exec(appBuildCommand, {
    cwd: location,
  });
};

const dotnetBuilder = (location, name, colour) => {
  const appBuildCommand = [
    "CI=1",
    concurrentlyBin,
    `--names ${name}`,
    `-c '${colour}'`,
    `--kill-others-on-fail`,
    `"dotnet build"`,
    `--color=always`,
  ].join(" ");
  exec(appBuildCommand, {
    cwd: location,
  });
};

const builder = () => {
  const { app_location, api_location, app_build_command, api_build_command } = readConfigFile();
  const runtimeType = detectRuntime(app_location);

  try {
    switch (runtimeType) {
      case RuntimeType.dotnet:
        {
          // build app
          dotnetBuilder(app_location, "app_build", "bgGreen.bold");

          // NOTE: API is optional. Build it only if it exists
          // This may result in a double-compile of some libraries if they are shared between the
          // Blazor app and the API, but it's an acceptable outcome
          let apiLocation = path.resolve(process.cwd(), api_location);
          if (fs.existsSync(apiLocation) === true && fs.existsSync(path.join(apiLocation, "host.json"))) {
            dotnetBuilder(apiLocation, "api_build", "bgYellow.bold");
          }
        }
        break;

      case RuntimeType.node:
      default:
        {
          // figure out if appLocation exists
          let appLocation = app_location;
          if (fs.existsSync(appLocation) === false) {
            appLocation = process.cwd();
          }

          // build app
          nodeBuilder(appLocation, app_build_command, "app_build", "bgGreen.bold");

          // NOTE: API is optional. Build it only if it exists
          let apiLocation = path.resolve(process.cwd(), api_location);
          if (fs.existsSync(apiLocation) === true && fs.existsSync(path.join(apiLocation, "host.json"))) {
            nodeBuilder(apiLocation, api_build_command, "api_build", "bgYellow.bold");
          }
        }
        break;
    }
  } catch (stderr) {
    console.error(stderr);
  }
};
export default builder;
