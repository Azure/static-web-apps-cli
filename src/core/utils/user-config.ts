import chalk from "chalk";
import fs, { promises as fsPromises } from "fs";
import type http from "http";
import path from "path";
import Ajv from "ajv";
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
  const configFiles = new Map<string, { filepath: string; isLegacyConfigFile: boolean; content: string }>();
  // const parse = await getSWAConfigSchemaParser();
  const validate = await getSWAConfigSchemaValidator();

  for await (const filepath of traverseFolder(folder)) {
    const filename = path.basename(filepath) as string;

    if (filename === DEFAULT_CONFIG.swaConfigFilename || filename === DEFAULT_CONFIG.swaConfigFilenameLegacy) {
      const content = (await readFile(filepath)).toString("utf-8");
      const config = JSON.parse(content);

      console.log({ content });

      // make sure we are using the right SWA config file.
      // Note: some JS frameworks (eg. Nuxt, Scully) use routes.json as part of their config. We need to ignore those
      const isValidSWAConfigFile =
        validate(content) || config.globalHeaders || config.mimeTypes || config.navigationFallback || config.responseOverrides || config.routes;
      if (isValidSWAConfigFile) {
        const isLegacyConfigFile = filename === DEFAULT_CONFIG.swaConfigFilenameLegacy;
        configFiles.set(filename, { filepath, isLegacyConfigFile, content });
      } else {
        logger.info(`    ${chalk.yellow(`WARNING: invalid ${filename} file detected`)}\n`);
      }
    }
  }
  // take staticwebapp.config.json if it exists (and ignore routes.json legacy file)
  if (configFiles.has(DEFAULT_CONFIG.swaConfigFilename!)) {
    const file = configFiles.get(DEFAULT_CONFIG.swaConfigFilename!);
    logger.silly(`Found ${DEFAULT_CONFIG.swaConfigFilename} in ${file?.filepath}`);
    return file;
  }

  // fallback to legacy config file
  if (configFiles.has(DEFAULT_CONFIG.swaConfigFilenameLegacy!)) {
    const file = configFiles.get(DEFAULT_CONFIG.swaConfigFilenameLegacy!);
    logger.silly(`Found ${DEFAULT_CONFIG.swaConfigFilenameLegacy} in ${file?.filepath}`);
    return file;
  }

  // no config file found
  logger.silly(`No ${DEFAULT_CONFIG.swaConfigFilename} found in current project`);
  return null;
}

async function loadSchema() {
  // const res = await fetch("https://json.schemastore.org/staticwebapp.config.json");
  // return await res.json();

  return require(path.join(__dirname, "../../schema/staticwebapp.config.schema.json"));
}

// @ts-ignore
async function getSWAConfigSchemaValidator() {
  const ajv = new Ajv({
    meta: false, // optional, to prevent adding draft-06 meta-schema,
    strict: false,
  });
  const schema = await loadSchema();
  // patchDraftV4Schema(ajv);
  const validate = ajv.compile(schema);

  // memoise so we avoid recompiling the schema on each call
  return (data: string) => validate(data);
}

// // @ts-ignore
// async function getSWAConfigSchemaParser() {
//   const jtd = new JTD({
//     meta: false, // optional, to prevent adding draft-06 meta-schema,

//   });
//   patchDraftV4Schema(jtd);
//   const schema = await loadSchema();
//   const parse = jtd.compileParser(schema);

//   // memoise so we avoid recompiling the schema on each call
//   return (data: string) => parse(data);
// }

// function patchDraftV4Schema(ajv: Ajv) {
//   // See https://github.com/ajv-validator/ajv/releases/tag/5.0.0
//   const metaSchema = require("ajv-draft-04/dist/refs/json-schema-draft-04.json");
//   ajv.addMetaSchema(metaSchema);
//   ajv.opts.defaultMeta = metaSchema.id;

//   // optional, using unversioned URI is out of spec, see https://github.com/json-schema-org/json-schema-spec/issues/216
//   ajv.refs["http://json-schema.org/schema"] = "http://json-schema.org/draft-04/schema";
// }

/**
 * Valide and normalize all paths of a workflow confifuration.
 * @param userWorkflowConfig The project workflow configuration.
 * @returns A configuration object.
 */
export function validateUserWorkflowConfig(userWorkflowConfig: Partial<GithubActionWorkflow> | undefined): Partial<GithubActionWorkflow> | undefined {
  let appLocation = undefined;
  let apiLocation = undefined;
  let outputLocation = undefined;

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
  });

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
