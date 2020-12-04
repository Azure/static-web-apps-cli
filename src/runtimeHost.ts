import path from "path";
import { detectRuntime, RuntimeType } from "./runtimes";

const httpServerBin = path.resolve(__dirname, "..", "./node_modules/.bin/http-server");
export const createRuntimeHost = ({ appPort, proxyHost, proxyPort, appLocation, appArtifactLocation }: RuntimeHostConfig) => {
  const runtimeType = detectRuntime(appLocation);

  console.log(">> detected runtime:", runtimeType);

  switch (runtimeType) {
    // .NET runtime
    case RuntimeType.dotnet:
      return {
        command: "dotnet",
        args: `watch --project ${appLocation} run --urls=http://localhost:${appPort}`.split(" "),
      };

    // Node.js runtime or static sites
    case RuntimeType.node:
    case RuntimeType.unknown:
    default:
      // See available options for http-server: https://github.com/http-party/http-server#available-options
      // Note: --proxy allows us to add fallback routes for SPA (https://github.com/http-party/http-server#catch-all-redirect)
      const command = httpServerBin;
      if (!appArtifactLocation) {
        console.log(`WARN: --app-artifact-location was not provided. Setting default value to "./"`);
        appArtifactLocation = "./";
      }
      const args = `${appArtifactLocation} --port ${appPort} --cache -1 --proxy http://${proxyHost}:${proxyPort}/?`.split(" ");

      return {
        command,
        args,
      };
  }
};
