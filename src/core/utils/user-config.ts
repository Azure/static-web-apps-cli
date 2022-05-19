import Ajv4, { JSONSchemaType, ValidateFunction } from "ajv-draft-04";
import chalk from "chalk";
import fs from "fs";
import type http from "http";
import jsonMap from "json-source-map";
import fetch, { RequestInit } from "node-fetch";
import path from "path";
import { SWA_CONFIG_FILENAME, SWA_CONFIG_FILENAME_LEGACY, SWA_RUNTIME_CONFIG_MAX_SIZE_IN_KB } from "../constants";
import { logger } from "./logger";
import { isHttpUrl } from "./net";
const { readdir, readFile, stat } = fs.promises;

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
      const content = await validateRuntimeConfigAndGetData(file.filepath!);

      if (content) {
        const fileSize = (await stat(file.filepath)).size;
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

export async function validateRuntimeConfigAndGetData(filepath: string): Promise<SWAConfigFile | null> {
  const ajv4 = new Ajv4({
    strict: false,
    allErrors: true,
  });

  logger.silly(`Loading staticwebapp.config.json schema...`);
  const schema = await loadSWAConfigSchema();
  if (!schema) {
    logger.warn(`WARNING: Failed to load staticwebapp.config.json schema. Continuing without validation!`);
    return null;
  }

  logger.silly(`Compiling schema...`);
  const validate = ajv4.compile(schema);

  logger.silly(`Reading content from staticwebapp.config.json...`);
  const content = (await readFile(filepath)).toString("utf-8");

  let config;
  try {
    logger.silly(`Parsing staticwebapp.config.json...`);
    config = JSON.parse(content);
  } catch (err) {
    printJSONValidationWarnings(filepath, content, (err as any).message);
    return null;
  }

  logger.silly(`Validating staticwebapp.config.json...`);
  const isValidSWAConfigFile = validate(config);

  if (!isValidSWAConfigFile) {
    printSchemaValidationWarnings(filepath, config, validate);
    return null;
  }

  logger.silly(`File validated successfully. Continuing with configuration!`);
  return config;
}

function findLineAndColumnByPosition(content: string, position: number | undefined) {
  const notFound = { line: -1, column: -1 };
  if (!position) {
    return notFound;
  }

  const lines = content.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineChars = line.split("");
    const lineLength = lineChars.length;

    for (let columnIndex = 0; columnIndex <= lineLength; columnIndex++) {
      // decrement position by 1 until we reach 0
      position--;

      // if position is 0, then we found the line
      if (position === 0) {
        return {
          line: lineIndex,
          column: columnIndex,
        };
      }
    }
  }
  return notFound;
}

async function loadSWAConfigSchema(): Promise<JSONSchemaType<SWACLIConfigFile> | null> {
  const schemaUrl = "https://json.schemastore.org/staticwebapp.config.json";
  try {
    const res = await fetch(schemaUrl, { timeout: 10 * 1000 } as RequestInit);
    if (res.status === 200) {
      logger.silly(`Schema loaded successfully from ${schemaUrl}`);
      return (await res.json()) as JSONSchemaType<SWACLIConfigFile>;
    }
  } catch {}

  logger.silly(`Failed to load schema from ${schemaUrl}`);
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
  return req.url?.endsWith(`/${SWA_CONFIG_FILENAME}`) || req.url?.endsWith(`/${SWA_CONFIG_FILENAME_LEGACY}`);
}

function printJSONValidationWarnings(filepath: string, data: string, errorMessage: string) {
  logger.warn(`WARNING: Failed to read staticwebapp.config.json configuration from:\n   ${filepath}\n`);
  logger.error(`The following error was encountered: ${errorMessage}`);

  if (errorMessage.includes("Unexpected token")) {
    // extract the position of the error
    let [_, position] = errorMessage.match(/in JSON at position (\d+)/)?.map(Number) ?? [undefined, undefined];
    const lines = data.split("\n");
    const lineAndColumn = findLineAndColumnByPosition(data, position);
    const lineIndex = lineAndColumn.line;
    if (lineIndex !== -1) {
      let errorMessage = "";
      const errorOffsetLines = 2;
      const startLine = Math.max(lineIndex - errorOffsetLines, 0);
      const endLine = Math.min(lineIndex + errorOffsetLines, lines.length);

      for (let index = startLine; index < endLine; index++) {
        const line = lines[index];
        if (index === lineIndex) {
          errorMessage += chalk.bgRedBright(chalk.grey(`${index + 1}:`) + ` ${line}\n`);
        } else {
          errorMessage += chalk.grey(`${index + 1}:`) + ` ${line}\n`;
        }
      }
      logger.warn(errorMessage);
    }
  }

  logger.warn(`Please fix the above error and try again to load and use the configuration.`);
  logger.warn(`Read more: https://aka.ms/swa/config-schema`);
}

function printSchemaValidationWarnings(filepath: string, data: SWAConfigFile | undefined, validator: ValidateFunction<any>) {
  let sourceCodeWhereErrorHappened = "";
  const sourceMap = jsonMap.stringify(data, null, 4);
  const jsonLines: string[] = sourceMap.json.split("\n");
  const error = validator.errors?.[0];
  const errorOffsetLines = 2;

  // show only one error at a time
  if (error) {
    let errorPointer = sourceMap.pointers[error.instancePath];
    logger.silly({ errorPointer, error });

    let startLine = Math.max(errorPointer.value.line - errorOffsetLines, 0);
    const endLine = Math.min(errorPointer.valueEnd.line + errorOffsetLines, jsonLines.length);

    for (let index = startLine; index < endLine; index++) {
      const line = jsonLines[index];
      const isOneLine = errorPointer.value.line === errorPointer.valueEnd.line;
      const lineHasError = error.params.additionalProperty && line.match(error.params.additionalProperty)?.length;
      let shouldHighlightLine = (isOneLine && index === errorPointer.value.line) || lineHasError;

      if (error.params.missingProperty) {
        // special case to highlight object where the property is missing
        shouldHighlightLine = index >= errorPointer.value.line && index <= errorPointer.valueEnd.line;
      }

      if (shouldHighlightLine) {
        // highlight the line where the error happened
        sourceCodeWhereErrorHappened += chalk.bgRedBright(chalk.grey(`${index}:`) + ` ${line}\n`);
      } else {
        sourceCodeWhereErrorHappened += chalk.grey(`${index}:`) + ` ${line}\n`;
      }
    }
    logger.warn(`WARNING: Failed to read staticwebapp.config.json configuration from:\n   ${filepath}\n`);
    let errorMessage = error?.message ?? "Unknown error";
    switch (error?.keyword) {
      case "enum":
        errorMessage = error?.message + " " + error.params.allowedValues.join(", ");
        break;
      case "type":
        errorMessage = error?.message!;
        break;
      case "required":
        errorMessage = `The property "${error?.params.missingProperty}" is required.`;
        break;
      case "additionalProperties":
        errorMessage = `The property "${error.params.additionalProperty}" is not allowed (Line: ${startLine})`;
        break;
      //TODO: add more cases
    }
    logger.warn(`The following error was encountered: ${errorMessage}`);

    logger.warn(sourceCodeWhereErrorHappened);
    logger.warn(`Please fix the above error and try again to load and use the configuration.`);
    logger.warn(`Read more: https://aka.ms/swa/config-schema`);
  }
}
