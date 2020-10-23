import path from "path";
import fs from "fs";

export enum RuntimeType {
  dotnet = "dotnet",
  node ="node",
  unknown = "unknown",
};

export const detectRuntime = (app_location: string) => {
  if (fs.existsSync(app_location) === false) {
    console.error(`The provided "app_location" was not found. Can't detect runtime!`);
    console.error(app_location);
    return RuntimeType.unknown;
  }

  const files = fs.readdirSync(app_location);

  if (files.some((file) => path.extname(file) === ".csproj")) {
    return RuntimeType.dotnet;
  }

  if (files.includes("package.json")) {
    return RuntimeType.node;
  }

  return RuntimeType.unknown;
};
