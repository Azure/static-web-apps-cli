import { promises as fs } from "fs";
import path from "path";
import { logger } from "./logger";
import { stripJsonComments } from "./strings";

export async function safeReadJson(path: string): Promise<JsonData | undefined> {
  try {
    let contents = await fs.readFile(path, "utf8");
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
    return await fs.readFile(path, "utf8");
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

// Look for a package.json file starting from startPath up to rootPath,
// and return its containing directory.
// Note that startPath is relative to rootPath.
export async function findUpPackageJsonDir(rootPath: string, startPath: string): Promise<string | undefined> {
  if (!rootPath || !startPath) {
    return undefined;
  }

  rootPath = rootPath === "." || rootPath === `.${path.sep}` ? "" : rootPath;
  startPath = path.join(rootPath, startPath);
  const rootPathLength = rootPath.split(/[/\\]/).filter((c) => c).length;
  const find = async (components: string[]): Promise<string | undefined> => {
    if (components.length === 0 || components.length < rootPathLength) {
      return undefined;
    }

    const dir = path.join(...components);
    const packageFile = path.join(dir, "package.json");
    return (await pathExists(packageFile)) ? dir : find(components.slice(0, -1));
  };

  const components = startPath.split(/[/\\]/).filter((c) => c);
  return find(components);
}
