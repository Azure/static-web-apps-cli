import { promises as fs } from "fs";
import { logger } from "./logger";

export function dasherize(str: string) {
  return str
    .replace(/([a-z\d])([A-Z]+)/g, "$1-$2")
    .replace(/[ _]+/g, "-")
    .toLowerCase();
}

export function stripJsonComments(json: string) {
  return json.replace(
    /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/gm,
    (match, group) => group ? "" : match
  );
}

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
