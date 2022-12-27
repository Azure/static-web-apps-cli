import { logger } from "../utils";
import { installAndGetDataApiBuilder } from "./dab";

/**
 * Ideally this function should get the dab binary path and run it
 */

export async function getDataApiBuilderBinaryPath(): Promise<string> {
  const binary = await installAndGetDataApiBuilder();
  logger.silly(`DAB.exe found at ${binary.binaryPath}`);

  return binary.binaryPath;
}
