import chalk from "chalk";
import { logger } from "./logger";

/**
 *  Turn expression into a valid regex
 */
export function globToRegExp(glob: string | undefined) {
  logger.silly(`turning glob expression into valid RegExp...`);
  logger.silly(` - glob: ${chalk.yellow(glob)}`);

  if (!glob) {
    logger.silly(` - glob is empty, return empty string.`);
    return "";
  }

  const filesExtensionMatch = glob.match(/{.*}/);
  if (filesExtensionMatch) {
    const filesExtensionExpression = filesExtensionMatch[0];
    if (filesExtensionExpression) {
      // build a regex group (png|jpg|gif)
      const filesExtensionRegEx = filesExtensionExpression.replace(/\,/g, "|").replace("{", "(").replace("}", ")");
      glob = glob.replace(filesExtensionExpression, filesExtensionRegEx);
    }
  }

  return glob.replace(/\//g, "\\/").replace("*.", ".*").replace("/*", "/.*");
}
