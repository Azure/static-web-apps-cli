const path = require("path");
const fs = require("fs");

const RuntimeType = {
  dotnet: "dotnet",
  node: "node",
};

module.exports.RuntimeType = RuntimeType;

module.exports.detectRuntime = (app_location) => {
  const files = fs.readdirSync(app_location);

  if (files.some((file) => path.extname(file) === ".csproj")) {
    return RuntimeType.dotnet;
  }

  return RuntimeType.node;
};
