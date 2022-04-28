import { promises as fs } from "fs";
import { logger } from "./logger";
import { stripJsonComments } from "./strings";

export async function safeReadJson(path: string): Promise<JsonData | undefined> {
  try {
    let contents = await fs.readFile(path, 'utf8');
    contents = stripJsonComments(contents);
    return JSON.parse(contents) as JsonData;
  } catch (error) {
    logger.warn(`Failed to read JSON file at: ${path}`);
    return undefined;
  }
}

export async function safeReadFile(path?: string): Promise<string | undefined> {
  if (!path) {
    return undefined;
  }

  try {
    return await fs.readFile(path, 'utf8');
  } catch (error) {
    logger.warn(`Failed to read file at: ${path}`);
    return undefined;
  }
}

export async function pathExists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
