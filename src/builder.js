const fs = require("fs");
const path = require("path");
const shell = require("shelljs");
const { readConfigFile, detectRuntime, RuntimeType } = require("./utils");

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

module.exports = () => {
  const { app_location, api_location, app_build_command, api_build_command } = readConfigFile();
  const runtimeType = detectRuntime(app_location);

  try {
    switch (runtimeType) {
      case RuntimeType.node:
      default:
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
        break;
    }
  } catch (stderr) {
    console.error(stderr);
  }
};
