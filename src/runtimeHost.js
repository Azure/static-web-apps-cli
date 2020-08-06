const path = require("path");
const { readConfigFile } = require("./utils");
const { detectRuntime, RuntimeType } = require("./runtimes");

const httpServerBin = path.resolve(__dirname, "..", "./node_modules/.bin/http-server");
module.exports.createRuntimeHost = (port, proxyHost, proxyPort) => {
  const { app_location, app_artifact_location } = readConfigFile();
  const runtimeType = detectRuntime(app_location);

  switch (runtimeType) {
    case RuntimeType.dotnet:
      return {
        command: "dotnet",
        args: `watch --project ${app_location} run --urls=http://localhost:${port}`.split(" "),
      };

    case RuntimeType.node:
    default:
      const command = httpServerBin;
      const args = `${app_artifact_location} -p ${port} -c-1 --proxy http://${proxyHost}:${proxyPort}/?"`.split(" ");

      return {
        command,
        args,
      };
  }
};
