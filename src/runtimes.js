const path = require("path");
const fs = require("fs");

const RuntimeType = {
  dotnet: "dotnet",
  node: "node",
  unknown: "unknown",
};

module.exports.RuntimeType = RuntimeType;

module.exports.detectRuntime = (app_location) => {

  if (fs.existsSync(app_location) === false) {
    console.error(`The provided "app_location" was not found. Can't detect runtime!`);
    console.error(app_location);
    return RuntimeType.unknown;
  }

  const files = fs.readdirSync(app_location);

  if (files.some((file) => path.extname(file) === ".csproj")) {
    console.log(">> .NET detected.");
    return RuntimeType.dotnet;
  }

  if (files.includes("package.json")) {
    console.log(">> Node.js detected.");
    return RuntimeType.node;
  }

  console.log(">> Unknown runtime detected.");
  return RuntimeType.unknown;
};
