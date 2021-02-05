import { detectRuntime, RuntimeType } from "./runtimes";
import { getBin } from "./utils";

const httpServerBin = getBin("http-server");
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
      const command = httpServerBin;
      if (!appArtifactLocation) {
        console.log(`WARN: --app-artifact-location was not provided. Setting default value to "./"`);
        appArtifactLocation = "./";
      }
      // See available options for http-server: https://github.com/http-party/http-server#available-options
      // Note: --proxy allows us to add fallback routes for SPA (https://github.com/http-party/http-server#catch-all-redirect)
      const args = `${appArtifactLocation} --port ${appPort} --cache -1 --proxy http://${proxyHost}:${proxyPort}/?`.split(" ");

      return {
        command,
        args,
      };
  }
};
