import { DEFAULT_CONFIG } from "../config";
import { detectRuntime, RuntimeType } from "./runtimes";

// TODO: unused, clean up
const httpServerBin = "npx http-server";
export function createRuntimeHost({ appPort, proxyHost, appLocation, outputLocation }: RuntimeHostConfig) {
  const runtimeType = detectRuntime(appLocation);

  switch (runtimeType) {
    // .NET runtime
    case RuntimeType.dotnet:
      return {
        command: "dotnet",
        args: `watch --project ${appLocation} run --urls=http://${proxyHost}:${appPort}`.split(" "),
      };

    // Node.js runtime or static sites
    case RuntimeType.node:
    case RuntimeType.unknown:
    default:
      const command = httpServerBin;
      outputLocation = outputLocation || DEFAULT_CONFIG.outputLocation;
      // See available options for http-server: https://github.com/http-party/http-server#available-options
      // Note: --proxy allows us to add fallback routes for SPA (https://github.com/http-party/http-server#catch-all-redirect)
      const args = `${outputLocation} -d false --host ${proxyHost} --port ${appPort} --cache -1`.split(" ");

      return {
        command,
        args,
      };
  }
}
