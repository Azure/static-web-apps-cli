const path = require("path");
const { readConfigFile } = require("./utils");
const { detectRuntime, RuntimeType } = require("./runtimes");

const httpServerBin = path.resolve(__dirname, "..", "./node_modules/.bin/http-server");

module.exports.createRuntimeHost = (port, proxyHost, proxyPort) => {
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
      const args = `${app_artifact_location} -p ${port} -c-1 --proxy http://${proxyHost}:${proxyPort}/?`.split(" ");

      return {
        command,
        args,
      };
  }
};
