// import { logger } from "../utils";
import { getDataApiBuilderPath } from "./dab";

/**
 * Ideally this function should get the dab binary path and run it
 */

export async function dab_main() {
  const binaryPath = await getDataApiBuilderPath();
  console.log(binaryPath);
}
