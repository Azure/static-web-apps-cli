import path from "path";
import { readConfigFile } from "./utils";
import { detectRuntime, RuntimeType } from "./runtimes";

const httpServerBin = path.resolve(__dirname, "..", "./node_modules/.bin/http-server");

export const createRuntimeHost = (port: number, proxyHost: string, proxyPort: number) => {
  const { app_location, app_artifact_location } = readConfigFile();
  const runtimeType = detectRuntime(app_location);

  console.log(">> detected runtime:", runtimeType);

  switch (runtimeType) {
    // .NET runtime
    case RuntimeType.dotnet:
      return {
        command: "dotnet",
        args: `watch --project ${app_location} run --urls=http://localhost:${port}`.split(" "),
      };

    // Node.js runtime or static sites
    case RuntimeType.node:
    case RuntimeType.unknown:
    default:
      // See available options for http-server: https://github.com/http-party/http-server#available-options
      // Note: --proxy allows us to add fallback routes for SPA (https://github.com/http-party/http-server#catch-all-redirect)
      const command = httpServerBin;
      const args = `${app_artifact_location} --port ${port} --cache -1 --proxy http://${proxyHost}:${proxyPort}/?`.split(" ");

      return {
        command,
        args,
      };
  }
};
