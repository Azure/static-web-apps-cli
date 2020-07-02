const fs = require("fs");
const path = require("path");
const shell = require("shelljs");
const { readConfigFile } = require("./utils");

const exec = (command, options = {}) => shell.exec(command, { async: false, ...options });

module.exports = () => {
  const { app_location, api_location, app_build_command, api_build_command } = readConfigFile();

  // use the concurrently binary provided by this emulator
  const concurrentlyBin = path.resolve(__dirname, "..", "./node_modules/.bin/concurrently");

  try {
    // figure out if appLocation exists
    let appLocation = path.resolve(process.cwd(), app_location);
    if (appLocation === "" || appLocation === "/" || fs.existsSync(appLocation) === false) {
      appLocation = process.cwd();
    }

    // build app
    const appBuildCommand = [
      concurrentlyBin,
      `--names app_build`,
      `-c 'bgGreen.bold'`,
      `--kill-others-on-fail`,
      `"${app_build_command}"`,
      `--color=always`,
    ].join(" ");
    exec(appBuildCommand, {
      cwd: appLocation,
    });

    // NOTE: API is optional. Build it only if it exists
    let apiLocation = path.resolve(process.cwd(), api_location);
    if (fs.existsSync(apiLocation) === true) {
      const apiBuildCommand = [
        concurrentlyBin,
        `--names api_build`,
        `--kill-others-on-fail`,
        `-c 'bgYellow.bold'`,
        `"${api_build_command}"`,
        `--color=always`,
      ].join(" ");
      exec(apiBuildCommand, {
        cwd: apiLocation,
      });
    }
  } catch (stderr) {
    console.error(stderr);
  }
};
