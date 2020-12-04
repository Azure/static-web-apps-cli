import fs from "fs";
import path from "path";

export enum RuntimeType {
  dotnet = "dotnet",
  node = "node.js",
  unknown = "unknown",
}

export const detectRuntime = (appLocation: string | undefined) => {
  if (!appLocation || fs.existsSync(appLocation) === false) {
    console.warn(`WARNING: The provided app location "${appLocation}" was not found. Can't detect runtime!`);
    return RuntimeType.unknown;
  }

  const files = fs.readdirSync(appLocation);

  if (files.some((file) => path.extname(file) === ".csproj")) {
    return RuntimeType.dotnet;
  }

  if (files.includes("package.json")) {
    return RuntimeType.node;
  }

  return RuntimeType.unknown;
};
