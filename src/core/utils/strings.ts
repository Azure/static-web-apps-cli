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
    // 1. \\" matches escaped double quotes to avoid being captured by the removing groups
    // 2. "(?:\\"|[^"])*" matches anything inside double quotes, including escaped double quotes
    //    in a non-capturing group to avoid removing anything inside strings
    // 3. (\/\/.*|\/\*[\s\S]*?\*\/) capture anything after a double slash until newline, or
    //    in-between slash-star comments including newlines in a non-greedy way
    // Only the captured group is removed, ignoring comments inside strings as a result
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
