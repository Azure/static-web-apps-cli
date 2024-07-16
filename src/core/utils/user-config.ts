import chalk from "chalk";
import { promises as fs, Dirent } from "node:fs";
import type http from "node:http";
import path from "node:path";
import { SWA_CONFIG_FILENAME, SWA_CONFIG_FILENAME_LEGACY, SWA_RUNTIME_CONFIG_MAX_SIZE_IN_KB } from "../constants.js";
import { logger } from "./logger.js";
import { isHttpUrl } from "./net.js";
import { loadJSON, validateConfigFile } from "./json.js";

/**
 * A utility function to recursively traverse a folder and returns its entries.
 * @param folder The folder to traverse.
 * @returns A Generator object that yields entry paths.
 * @example
 * ```
 * for await (const file of traverseFolder(folder)) {
 *    console.log(file);
 * }
 * ```
 */
export async function* traverseFolder(folder: string): AsyncGenerator<string> {
  const folders = (await fs.readdir(folder, { withFileTypes: true })) as Dirent[];
  for (const folderEntry of folders) {
    // WARNING: ignore node_modules and other common folders to avoid perf hits!
    if (folderEntry.name.includes("node_modules") || folderEntry.name.startsWith(".git")) {
      continue;
    }
    const entryPath = path.resolve(folder, folderEntry.name);
    if (folderEntry.isDirectory()) {
      yield* traverseFolder(entryPath);
    } else {
      yield entryPath;
    }
  }
}

/**
 * Find the `staticwebapp.config.json` (or `routes.json`) configuration file in a specific folder.
 * @param folder The folder where to lookup for the configuration file.
 * @returns `staticwebapp.config.json` if it was found, or fallback to `routes.json`. Return `null` if none were found.
 */
export async function findSWAConfigFile(folder: string): Promise<{ filepath: string; content: SWAConfigFile } | null> {
  const configFiles = new Map<string, { filepath: string; isLegacyConfigFile: boolean }>();
  for await (const filepath of traverseFolder(folder)) {
    const filename = path.basename(filepath) as string;

    if (filename === SWA_CONFIG_FILENAME || filename === SWA_CONFIG_FILENAME_LEGACY) {
      const isLegacyConfigFile = filename === SWA_CONFIG_FILENAME_LEGACY;
      configFiles.set(filename, { filepath, isLegacyConfigFile });
    }
  }

  // take staticwebapp.config.json if it exists
  if (configFiles.has(SWA_CONFIG_FILENAME)) {
    const file = configFiles.get(SWA_CONFIG_FILENAME);

    if (file) {
      const config = await loadJSON(file.filepath!);
      if (config) {
        const content = await validateConfigFile(config);
        if (content) {
          const fileSize = (await fs.stat(file.filepath)).size;
          const fileSizeInKb = Math.round(fileSize / 1024);
          if (fileSizeInKb > SWA_RUNTIME_CONFIG_MAX_SIZE_IN_KB) {
            logger.warn(`WARNING: ${SWA_CONFIG_FILENAME} is ${fileSizeInKb} bytes. The maximum size is ${SWA_RUNTIME_CONFIG_MAX_SIZE_IN_KB} bytes.`);
          }

          logger.silly(`Content parsed successfully`);

          logger.log(`\nFound configuration file:\n  ${chalk.green(file.filepath)}\n`);
          return {
            filepath: file.filepath,
            content,
          };
        }
      }
    }

    return null;
  }

  // legacy config file detected. Warn and return null.
  if (configFiles.has(SWA_CONFIG_FILENAME_LEGACY)) {
    const file = configFiles.get(SWA_CONFIG_FILENAME_LEGACY);
    logger.warn(`Found legacy configuration file: ${file?.filepath}.`);
    logger.warn(
      `   WARNING: Functionality defined in the routes.json file is now deprecated. File will be ignored!\n` +
        `   Read more: https://docs.microsoft.com/azure/static-web-apps/configuration#routes`
    );
    return null;
  }

  // no config file found
  logger.silly(`No ${SWA_CONFIG_FILENAME} found in current project`);
  return null;
}

/**
 * Valide and normalize all paths of a workflow confifuration.
 * @param userWorkflowConfig The project workflow configuration.
 * @returns A configuration object.
 */
export function validateUserWorkflowConfig(userWorkflowConfig: Partial<GithubActionWorkflow> | undefined): Partial<GithubActionWorkflow> | undefined {
  let appLocation = undefined;
  let apiLocation = undefined;
  let outputLocation = undefined;
  let dataApiLocation = undefined;

  logger.silly(`Validating user workflow config (BEFORE):`);
  logger.silly(userWorkflowConfig!);

  if (userWorkflowConfig?.appLocation) {
    appLocation = path.resolve(userWorkflowConfig.appLocation);
    if (path.isAbsolute(userWorkflowConfig.appLocation)) {
      appLocation = userWorkflowConfig.appLocation;
    }
  }

  if (userWorkflowConfig?.apiLocation) {
    if (isHttpUrl(userWorkflowConfig.apiLocation)) {
      apiLocation = userWorkflowConfig.apiLocation;
    } else {
      // use the user's config and construct an absolute path
      apiLocation = path.resolve(userWorkflowConfig.apiLocation);
    }

    if (path.isAbsolute(userWorkflowConfig.apiLocation)) {
      apiLocation = userWorkflowConfig.apiLocation;
    }
  }

  if (userWorkflowConfig?.dataApiLocation) {
    dataApiLocation = path.resolve(userWorkflowConfig.dataApiLocation);
    if (path.isAbsolute(userWorkflowConfig.dataApiLocation)) {
      dataApiLocation = userWorkflowConfig.dataApiLocation;
    }
  }

  if (userWorkflowConfig?.outputLocation) {
    // is dev server url?
    if (isHttpUrl(userWorkflowConfig.outputLocation)) {
      outputLocation = userWorkflowConfig.outputLocation;
    } else {
      outputLocation = path.resolve(userWorkflowConfig.outputLocation);
      if (path.isAbsolute(userWorkflowConfig.outputLocation)) {
        outputLocation = userWorkflowConfig.outputLocation;
      }
    }
  }

  logger.silly(`Validating user workflow config (AFTER):`);
  logger.silly({
    appLocation,
    apiLocation,
    outputLocation,
    dataApiLocation,
  });

  return {
    appLocation,
    apiLocation,
    outputLocation,
    dataApiLocation,
  };
}

/**
 * Check if an HTTP request path contains `staticwebapp.config.json`
 * @param req Node.js HTTP request object.
 * @returns True if the request is accessing the configuration file. False otherwise.
 */
export function isSWAConfigFileUrl(req: http.IncomingMessage) {
  return req.url?.endsWith(`/${SWA_CONFIG_FILENAME}`) || req.url?.endsWith(`/${SWA_CONFIG_FILENAME_LEGACY}`);
}
