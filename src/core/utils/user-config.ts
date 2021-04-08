import fs, { promises as fsPromises } from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { isHttpUrl } from "./net";
const { readdir, readFile } = fsPromises;

export async function* traverseFolder(folder: string): AsyncGenerator<string> {
  const folders = (await readdir(folder, { withFileTypes: true })) as fs.Dirent[];
  for (const folderEntry of folders) {
    if (folderEntry.name.includes("node_modules")) {
      // ignore folder
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

export async function findSWAConfigFile(folder: string) {
  const configFiles = new Map<string, { file: string; isLegacyConfigFile: boolean }>();

  for await (const file of traverseFolder(folder)) {
    const filename = path.basename(file) as string;

    if (filename === DEFAULT_CONFIG.swaConfigFilename || filename === DEFAULT_CONFIG.swaConfigFilenameLegacy) {
      const config = JSON.parse((await readFile(file)).toString("utf-8"));

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
    return configFiles.get(DEFAULT_CONFIG.swaConfigFilename!);
  }
  // legacy config file
  else if (configFiles.has(DEFAULT_CONFIG.swaConfigFilenameLegacy!)) {
    return configFiles.get(DEFAULT_CONFIG.swaConfigFilenameLegacy!);
  }

  // no config file found
  return null;
}

export function validateUserConfig(userConfig: Partial<GithubActionWorkflow> | undefined): Partial<GithubActionWorkflow> | undefined {
  let appLocation = undefined;
  let apiLocation = undefined;
  let outputLocation = undefined;

  if (userConfig?.appLocation) {
    appLocation = path.normalize(path.join(process.cwd(), userConfig.appLocation || `.${path.sep}`));
    if (path.isAbsolute(userConfig.appLocation)) {
      appLocation = userConfig.appLocation;
    }
  }

  if (userConfig?.apiLocation) {
    if (isHttpUrl(userConfig.apiLocation)) {
      apiLocation = userConfig.apiLocation;
    } else {
      // use the user's config and construct an absolute path
      apiLocation = path.normalize(path.join(process.cwd(), userConfig.apiLocation));
    }

    if (path.isAbsolute(userConfig.apiLocation)) {
      apiLocation = userConfig.apiLocation;
    }
  }

  if (userConfig?.outputLocation) {
    // is dev server url
    if (isHttpUrl(userConfig.outputLocation)) {
      outputLocation = userConfig.outputLocation;
    } else {
      outputLocation = path.normalize(path.join(process.cwd(), userConfig.outputLocation || `.${path.sep}`));
      if (path.isAbsolute(userConfig.outputLocation)) {
        outputLocation = userConfig.outputLocation;
      }
    }
  }

  return {
    appLocation,
    apiLocation,
    outputLocation,
  };
}
