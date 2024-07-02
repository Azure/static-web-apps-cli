import { DATA_API_BUILDER_BINARY_NAME } from "../constants.js";
import { logger } from "../utils/logger.js";
import { installAndGetDataApiBuilder } from "./dab.js";

/**
 * This function gets the Data-Api Builder binary path and returns it
 * @returns DataApiBuilderBinary path
 */
export async function getDataApiBuilderBinaryPath(): Promise<string> {
  const binary = await installAndGetDataApiBuilder();
  logger.silly(`${DATA_API_BUILDER_BINARY_NAME} found: ${binary.binaryPath}. Using this to start data-api server`);

  return binary.binaryPath;
}
