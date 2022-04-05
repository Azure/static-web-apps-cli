import fs, { promises as fsPromises } from "fs";
import type http from "http";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { logger } from "./logger";
import { isHttpUrl } from "./net";
const { readdir, readFile } = fsPromises;

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
  const folders = (await readdir(folder, { withFileTypes: true })) as fs.Dirent[];
  for (const folderEntry of folders) {
    if (folderEntry.name.includes("node_modules")) {
      // WARNING: ignore node_modules to avoid perf hits!
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
export async function findSWAConfigFile(folder: string) {
  const configFiles = new Map<string, { file: string; isLegacyConfigFile: boolean }>();

  for await (const file of traverseFolder(folder)) {
    const filename = path.basename(file) as string;

    if (filename === DEFAULT_CONFIG.swaConfigFilename || filename === DEFAULT_CONFIG.swaConfigFilenameLegacy) {
      let config = {} as SWAConfigFile;
      try {
        config = JSON.parse((await readFile(file)).toString("utf-8"));
      } catch (err) {
        logger.warn(``);
        logger.warn(`Error reading ${filename} configuration:`);
        logger.warn(`${(err as any).message} in "${file}"`);
      }

      // make sure we are using the right SWA config file.
      // Note: some JS frameworks (eg. Nuxt, Scully) use routes.json as part of their config. We need to ignore those
      const isValidSWAConfigFile = config.globalHeaders || config.mimeTypes || config.navigationFallback || config.responseOverrides || config.routes;
      if (isValidSWAConfigFile) {
        const isLegacyConfigFile = filename === DEFAULT_CONFIG.swaConfigFilenameLegacy;
        configFiles.set(filename, { file, isLegacyConfigFile });
      }
    }
  }

  // take staticwebapp.config.json if it exists (and ignore routes.json legacy file)
  if (configFiles.has(DEFAULT_CONFIG.swaConfigFilename!)) {
    const file = configFiles.get(DEFAULT_CONFIG.swaConfigFilename!);
    logger.silly(`Found ${DEFAULT_CONFIG.swaConfigFilename} in ${file?.file}`);
    return file;
  }

  // fallback to legacy config file
  if (configFiles.has(DEFAULT_CONFIG.swaConfigFilenameLegacy!)) {
    const file = configFiles.get(DEFAULT_CONFIG.swaConfigFilenameLegacy!);
    logger.silly(`Found ${DEFAULT_CONFIG.swaConfigFilenameLegacy} in ${file?.file}`);
    return file;
  }

  // no config file found
  logger.silly(`No ${DEFAULT_CONFIG.swaConfigFilename} found in current project`);
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

  if (userWorkflowConfig?.appLocation) {
    appLocation = path.normalize(path.join(process.cwd(), userWorkflowConfig.appLocation || `.${path.sep}`));
    if (path.isAbsolute(userWorkflowConfig.appLocation)) {
      appLocation = userWorkflowConfig.appLocation;
    }
  }

  if (userWorkflowConfig?.apiLocation) {
    if (isHttpUrl(userWorkflowConfig.apiLocation)) {
      apiLocation = userWorkflowConfig.apiLocation;
    } else {
      // use the user's config and construct an absolute path
      apiLocation = path.normalize(path.join(process.cwd(), userWorkflowConfig.apiLocation));
    }

    if (path.isAbsolute(userWorkflowConfig.apiLocation)) {
      apiLocation = userWorkflowConfig.apiLocation;
    }
  }

  if (userWorkflowConfig?.outputLocation) {
    // is dev server url?
    if (isHttpUrl(userWorkflowConfig.outputLocation)) {
      outputLocation = userWorkflowConfig.outputLocation;
    } else {
      outputLocation = path.normalize(path.join(process.cwd(), userWorkflowConfig.outputLocation || `.${path.sep}`));
      if (path.isAbsolute(userWorkflowConfig.outputLocation)) {
        outputLocation = userWorkflowConfig.outputLocation;
      }
    }
  }

  return {
    appLocation,
    apiLocation,
    outputLocation,
  };
}

/**
 * Check if an HTTP request path contains `staticwebapp.config.json`
 * @param req Node.js HTTP request object.
 * @returns True if the request is accessing the configuration file. False otherwise.
 */
export function isSWAConfigFileUrl(req: http.IncomingMessage) {
  return req.url?.endsWith(`/${DEFAULT_CONFIG.swaConfigFilename!}`) || req.url?.endsWith(`/${DEFAULT_CONFIG.swaConfigFilenameLegacy!}`);
}
