import fs from "fs";
import path from "path";
import { logger } from "./utils/index";

export enum RuntimeType {
  dotnet = "dotnet",
  node = "node.js",
  unknown = "unknown",
}

export function detectRuntime(appLocation: string | undefined) {
  let runtime = RuntimeType.unknown;
  if (!appLocation || fs.existsSync(appLocation) === false) {
    logger.info(`The provided app location "${appLocation}" was not found. Can't detect runtime!`);
    runtime = RuntimeType.unknown;
  } else {
    const files = fs.readdirSync(appLocation);

    if (files.some((file) => [".csproj", ".sln"].includes(path.extname(file)))) {
      runtime = RuntimeType.dotnet;
    }

    if (files.includes("package.json")) {
      runtime = RuntimeType.node;
    }
  }

  logger.silly(`Detected runtime:`, "swa");
  logger.silly({ runtime }, "swa");
  return runtime;
}
