import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import { detectRuntime, RuntimeType } from "./runtimes";
import { readConfigFile } from "./utils";

const nodeBuilder = (location: string, buildCommand: string, name: string, colour: string) => {
  return concurrently(
    [
      {
        command: `npm install && ${buildCommand}`,
        name: name,
        env: {
          CI: "1",
          cwd: location,
        },
        prefixColor: colour,
      },
    ],
    {
      killOthers: ["failure"],
    }
  );
};

const dotnetBuilder = (location: string, name: string, colour: string) => {
  return concurrently(
    [
      {
        command: `dotnet build`,
        name: name,
        env: {
          CI: "1",
          cwd: location,
        },
        prefixColor: colour,
      },
    ],
    {
      killOthers: ["failure"],
    }
  );
};

const builder = async ({ config }: { config: Partial<GithubActionSWAConfig> }) => {
  const configFile = readConfigFile();
  if (configFile) {
    let { appLocation, apiLocation, appBuildCommand, apiBuildCommand } = config as GithubActionSWAConfig;
    const runtimeType = detectRuntime(appLocation);

    try {
      switch (runtimeType) {
        case RuntimeType.dotnet:
          {
            // build app
            await dotnetBuilder(appLocation as string, "app_build", "bgGreen.bold");

            // NOTE: API is optional. Build it only if it exists
            // This may result in a double-compile of some libraries if they are shared between the
            // Blazor app and the API, but it's an acceptable outcome
            apiLocation = path.resolve(process.cwd(), apiLocation as string);
            if (fs.existsSync(apiLocation) === true && fs.existsSync(path.join(apiLocation, "host.json"))) {
              await dotnetBuilder(apiLocation, "api_build", "bgYellow.bold");
            }
          }
          break;

        case RuntimeType.node:
        default:
          {
            // figure out if appLocation exists
            if (fs.existsSync(appLocation as string) === false) {
              appLocation = process.cwd();
            }

            // build app
            await nodeBuilder(appLocation as string, appBuildCommand as string, "app_build", "bgGreen.bold");

            // NOTE: API is optional. Build it only if it exists
            apiLocation = path.resolve(process.cwd(), apiLocation as string);
            if (fs.existsSync(apiLocation) === true && fs.existsSync(path.join(apiLocation, "host.json"))) {
              await nodeBuilder(apiLocation, apiBuildCommand as string, "api_build", "bgYellow.bold");
            }
          }
          break;
      }
    } catch (stderr) {
      console.log(stderr);
    }
  }
};
export default builder;
