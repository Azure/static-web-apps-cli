import fs from "fs";
import path from "path";
import { logger } from "./utils/index";

export enum RuntimeType {
  dotnet = "dotnet",
  node = "node.js",
  unknown = "unknown",
}

export const detectRuntime = (appLocation: string | undefined) => {
  if (!appLocation || fs.existsSync(appLocation) === false) {
    logger.info(`The provided app location "${appLocation}" was not found. Can't detect runtime!`);
    return RuntimeType.unknown;
  }

  const files = fs.readdirSync(appLocation);

  if (files.some((file) => [".csproj", ".sln"].includes(path.extname(file)))) {
    return RuntimeType.dotnet;
  }

  if (files.includes("package.json")) {
    return RuntimeType.node;
  }

  logger.silly(`Detected runtime: ${RuntimeType}`);
  return RuntimeType.unknown;
};
