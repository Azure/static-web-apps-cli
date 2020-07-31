import fs from "fs";
import path from "path";
import shell, { ExecOptions } from "shelljs";
import { readConfigFile } from "./utils";

const exec = (command: string, options: ExecOptions = {}) => shell.exec(command, { async: false, ...options });

export default () => {
  const { app_location, api_location, app_build_command, api_build_command } = readConfigFile();

  // use the concurrently binary provided by this emulator
  const concurrentlyBin = path.resolve(__dirname, "..", "./node_modules/.bin/concurrently");

  try {
    // figure out if appLocation exists
    let appLocation = app_location;
    if (fs.existsSync(appLocation) === false) {
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
        `"npm install --production && ${api_build_command}"`,
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
