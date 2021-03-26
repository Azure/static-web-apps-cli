import chalk from "chalk";
import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import { detectRuntime, RuntimeType } from "./runtimes";
import { isHttpUrl, logger } from "./utils";

const nodeBuilder = (location: string, buildCommand: string, name: string, colour: string) => {
  return concurrently(
    [
      {
        command: `npm install && ${buildCommand}`,
        name: name,
        prefixColor: colour,
        env: {
          CI: "1",
        },
      },
    ],
    {
      cwd: location,
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
        },
        prefixColor: colour,
      },
    ],
    {
      cwd: location,
      killOthers: ["failure"],
    }
  );
};

const builder = async ({ config }: { config: Partial<GithubActionWorkflow> }) => {
  if (config) {
    let { appLocation, apiLocation, appBuildCommand, apiBuildCommand } = config as GithubActionWorkflow;
    const runtimeType = detectRuntime(appLocation);

    logger.silly(
      {
        config,
        runtimeType,
      },
      "swa"
    );

    try {
      switch (runtimeType) {
        case RuntimeType.dotnet:
          {
            // build app
            await dotnetBuilder(appLocation!, "dot", "dim.gray");

            // NOTE: API is optional. Build it only if it exists
            // This may result in a double-compile of some libraries if they are shared between the
            // Blazor app and the API, but it's an acceptable outcome
            apiLocation = path.resolve(process.cwd(), apiLocation!);
            if (fs.existsSync(apiLocation) === true && fs.existsSync(path.join(apiLocation, "host.json"))) {
              await dotnetBuilder(apiLocation, "api", "dim.gray");
            }
          }
          break;

        case RuntimeType.node:
        default:
          {
            // figure out if appLocation exists
            const isPackageJsonExists = fs.existsSync(appLocation!) && fs.existsSync(path.join(appLocation!, "package.json"));
            const isAppDevServer = isHttpUrl(config.outputLocation!);

            // build app
            if (isPackageJsonExists) {
              logger.silly(chalk.green("Building app..."), "npm");

              await nodeBuilder(appLocation!, appBuildCommand!, "npm", "dim.gray");
            } else if (isAppDevServer) {
              logger.silly(chalk.yellow(`Skipping app build: App served from ${config.outputLocation}`), "npm");
            } else {
              logger.silly(chalk.yellow("Skipping app build: No package.json found."), "npm");
            }

            // NOTE: API is optional. Build it only if it exists
            const isAzureFunctionsProject =
              apiLocation && fs.existsSync(apiLocation!) === true && fs.existsSync(path.join(apiLocation!, "host.json"));
            const isApiDevServer = isHttpUrl(config.apiLocation!);
            if (isAzureFunctionsProject) {
              logger.silly(chalk.green("Building API..."), "npm");
              await nodeBuilder(apiLocation!, apiBuildCommand!, "npm", "dim.gray");
            } else if (isApiDevServer) {
              logger.silly(chalk.yellow(`Skipping API build: API served from ${apiLocation}`), "npm");
            } else {
              logger.silly(chalk.yellow("Skipping API build: Not a valid Azure Functions project."), "npm");
            }
          }
          break;
      }
    } catch (stderr) {}
  }
};
export default builder;
