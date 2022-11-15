import { logger } from "../utils";
import { getDataApiBuilderPath } from "./dab";

/**
 * Ideally this function should get the dab binary path and run it
 */

export async function getDataApiBuilderBinary(): Promise<string> {
  const binaryPath = await getDataApiBuilderPath();
  logger.silly(binaryPath.binary);
  return binaryPath.binary;
}
