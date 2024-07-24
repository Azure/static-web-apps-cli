import jsonSchemaLibrary from "json-schema-library";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import { logger } from "./logger.js";
import { createRequire } from "node:module";

// import of JSON files requires node v20.10 - we are supporting node v18 or later,
// so we need to create requires.  Centralizing this into a single file ensures that
// we don't need to go hunting for import of JSON files.
const require = createRequire(import.meta.url);
const pkg = require("../../../package.json");
const configSchema = require("../../../schema/staticwebapp.config.json");

const { Draft04 } = jsonSchemaLibrary;

/**
 * Loads the package.json file from the root of the project.
 * @returns the parsed package.json object, or null if an error occurred.
 */
export function loadPackageJson(): any {
  return pkg;
}

/**
 * Loads JSON from the designated file path, printing any JSON errors to the console.
 * @param filePath The file path to the JSON file
 * @returns The typed JSON object, or null if an error occurred.
 */
export async function loadJSON(filePath: string): Promise<any | null> {
  logger.silly(`Reading content from staticwebapp.config.json...`);
  const fileContents = (await fs.readFile(filePath)).toString("utf-8");

  try {
    logger.silly(`Parsing ${filePath}...`);
    return JSON.parse(fileContents);
  } catch (err: unknown) {
    printJSONValidationWarnings(filePath, fileContents, (err as Error).message);
    return null;
  }
}

/**
 * Validates the provided object against the SWA Config File specification.
 *
 * @param content the parsed JSON object that should be validated.
 */
export async function validateConfigFile(content: any): Promise<SWAConfigFile | null> {
  const jsonValidator = new Draft04(configSchema);
  const errors = jsonValidator.validate(content);
  if (errors.length > 0) {
    logger.error(`Failed to validate staticwebapp.config.json schema. Errors: ${JSON.stringify(errors, null, 2)}`);
    logger.error(`Please fix the above error and try again to load and use the configuration.`);
    logger.error(`Read more: https://aka.ms/swa/config-schema`);
    return null;
  }

  return content as SWAConfigFile;
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
