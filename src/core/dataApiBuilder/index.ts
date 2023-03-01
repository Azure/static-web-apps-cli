import { DATA_API_BUILDER_BINARY_NAME } from "../constants";
import { logger } from "../utils";
import { installAndGetDataApiBuilder } from "./dab";

/**
 * This function gets the Data-Api Builder binary path and returns it
 * @returns DataApiBuilderBinary path
 */
export async function getDataApiBuilderBinaryPath(): Promise<string> {
  const binary = await installAndGetDataApiBuilder();
  logger.silly(`${DATA_API_BUILDER_BINARY_NAME} found: ${binary.binaryPath}. Using this to start data-api server`);

  return binary.binaryPath;
}
