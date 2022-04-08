import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import { logger } from "./logger";

export async function readFileIfExists(filePath: string) {
  logger.silly(`Reading file: ${filePath}`);

  if (fileExists(filePath)) {
    return (await readFile(filePath)).toString("utf-8");
  }

  logger.silly(`File not found: ${filePath}`);
  return null;
}

export function fileExists(filePath: string) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

export async function writeFileSafe(filePath: string, content: string, override: boolean = false) {
  if (fileExists(filePath)) {
    logger.silly(`File already exists: ${filePath}`);
  }

  if (override) {
    logger.silly(`Overriding file: ${filePath}`);
    await writeFile(filePath, content);
  }
}
