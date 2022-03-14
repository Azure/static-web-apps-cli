import chalk from "chalk";
import { logger } from "./logger";

/**
 * Turn expression into a valid regexp
 *
 * @param glob A string containing a valid wildcard expression
 * @returns a string containing a valid RegExp
 */
export function globToRegExp(glob: string | undefined) {
  logger.silly(`turning glob expression into valid RegExp`);
  logger.silly(` - glob: ${chalk.yellow(glob)}`);

  if (!glob) {
    logger.silly(` - glob is empty, return empty string`);
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

/**
 * Check if the route rule contains a valid wildcard expression
 *
 * @param glob A string containing a valid wildcard expression
 * @returns true if the glob expression is valid, false otherwise
 * @see https://docs.microsoft.com/azure/static-web-apps/configuration#wildcards
 */
export function isValidGlobExpression(glob: string | undefined) {
  logger.silly(`checking if glob expression is valid`);
  logger.silly(` - glob: ${chalk.yellow(glob)}`);

  if (!glob) {
    logger.silly(` - glob is empty. Return false`);
    return false;
  }

  if (glob === "*") {
    logger.silly(` - glob is *`);
    return true;
  }

  const hasWildcard = glob.includes("*");

  if (hasWildcard) {
    const paths = glob.split("*");
    if (paths.length > 2) {
      logger.silly(` - glob has more than one wildcard. Return false`);
      return false;
    }

    const pathBeforeWildcard = paths[0];
    if (pathBeforeWildcard && glob.endsWith("*")) {
      logger.silly(` - glob ends with *. Return true`);
      return true;
    }

    const pathAfterWildcard = paths[1];
    if (pathAfterWildcard) {
      logger.silly(` - pathAfterWildcard: ${chalk.yellow(pathAfterWildcard)}`);

      if (isBalancedCurlyBrackets(glob) === false) {
        logger.silly(` - pathAfterWildcard contains unbalanced { } syntax. Return false`);
        return false;
      }

      // match exactly extensions of type:
      // -->  /blog/*.html
      // --> /blog/*.{html,jpg}
      const filesExtensionMatch = pathAfterWildcard.match(/\.(\w+|\{\w+(,\w+)*\})$/);

      if (filesExtensionMatch) {
        logger.silly(`  - pathAfterWildcard match a file extension. Return true`);
        return true;
      } else {
        logger.silly(`  - pathAfterWildcard doesn't match a file extension. Return false`);
        return false;
      }
    }
  }

  return false;
}

/**
 * Checks if a string expression has balanced curly brackets
 *
 * @param str the string expression to be checked
 * @returns true if the string expression has balanced curly brackets, false otherwise
 */
export function isBalancedCurlyBrackets(str: string) {
  const stack = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "{") {
      stack.push(char);
    } else if (char === "}") {
      if (stack.length === 0) {
        return false;
      }
      stack.pop();
    }
  }
  return stack.length === 0;
}
