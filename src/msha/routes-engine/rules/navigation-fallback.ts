import chalk from "chalk";
import fs from "fs";
import type http from "http";
import path from "path";
import { logger } from "../../../core";
import { globToRegExp, isValidGlobExpression } from "../../../core/utils/glob";
import { AUTH_STATUS } from "../../../core/constants";
import { doesRequestPathMatchRoute } from "../route-processor";
import { getIndexHtml } from "./routes";
import { swaCLIEnv } from "../../../core/env";

// See: https://docs.microsoft.com/azure/static-web-apps/configuration#fallback-routes

export function navigationFallback(req: http.IncomingMessage, res: http.ServerResponse, navigationFallback: SWAConfigFileNavigationFallback) {
  let originlUrl = req.url;

  logger.silly("checking navigation fallback...");

  // don't process .auth requests
  if (originlUrl?.startsWith("/.auth")) {
    logger.silly(` - request ${chalk.yellow(originlUrl)} is auth`);
    logger.silly(` - ignoring navigation fallback`);
    return false;
  }

  // exit if no rewrite rule provided
  if (!navigationFallback?.rewrite) {
    logger.silly(` - rewrite rule is invalid (got: ${chalk.yellow(navigationFallback?.rewrite)})`);
    logger.silly(` - ignoring navigation fallback`);
    return false;
  }
  // exit if no exclude property provided, or exclude list is empty
  if (!navigationFallback?.exclude || navigationFallback?.exclude?.length === 0) {
    logger.silly(` - exclude rule is invalid (got: ${chalk.yellow(navigationFallback?.exclude)})`);
    logger.silly(` - ignoring navigation fallback`);
    return false;
  }

  // make sure we have a leading / in the URL
  if (navigationFallback.rewrite.startsWith("/") === false) {
    navigationFallback.rewrite = `/${navigationFallback.rewrite}`;
  }

  // is the requested file available on disk?
  const filename = getIndexHtml(originlUrl);
  const filepath = path.join(swaCLIEnv().SWA_CLI_OUTPUT_LOCATION!, filename!);
  const isFileFoundOnDisk = fs.existsSync(filepath);

  logger.silly(` - url: ${chalk.yellow(originlUrl)}`);
  logger.silly(` - file: ${chalk.yellow(filepath)} (exists: ${chalk.yellow(isFileFoundOnDisk)})`);

  // parse the exclusion rules and match at least one rule
  const isMatchedExcludeRule = navigationFallback?.exclude?.some((filter) => {
    if (isValidGlobExpression(filter) === false) {
      logger.silly(` - invalid rule ${chalk.yellow(filter)}`);
      logger.silly(` - mark as no match`);
      return false;
    }

    // we don't support full globs in the config file.
    // add this little utility to convert a wildcard into a valid glob pattern
    const regexp = new RegExp(`^${globToRegExp(filter)}$`);
    const isMatch = regexp.test(originlUrl!);

    logger.silly(`   - rule: ${chalk.yellow(filter)}`);
    logger.silly(`   - regexp: ${chalk.yellow(regexp)}`);
    logger.silly(`   - isRegexpMatch: ${chalk.yellow(isMatch)}`);

    return isMatch;
  });

  logger.silly(` - isMatchedExcludeRule: ${chalk.yellow(isMatchedExcludeRule)}`);

  // rules logic:
  // 1. if no exclude rules are provided, rewrite by default
  // 2. if a file exists on disk, and match exclusion => return it
  // 3. if a file doesn't exist on disk, and match exclusion => 404
  // 4. if a file exists on disk, and doesn't match exclusion => /index.html
  // 5. if a file doesn't exist on disk, and doesn't match exclusion => /index.html

  // note: given the complexity of all possible combinations, don't refactor the code below
  let rewriteUrl = req.url;
  // 1.
  if (!navigationFallback.exclude || navigationFallback.exclude.length === 0) {
    rewriteUrl = navigationFallback.rewrite;

    logger.silly(` - no exclude rules are provided (rewrite by default)`);
    logger.silly(` - url: ${chalk.yellow(rewriteUrl)}`);
  }
  // 2.
  else if (isFileFoundOnDisk === true && isMatchedExcludeRule === true) {
    rewriteUrl = req.url;

    logger.silly(` - file exists on disk, and match exclusion`);
    logger.silly(` - url: ${chalk.yellow(rewriteUrl)}`);
  }
  // 3.
  else if (isFileFoundOnDisk === false && isMatchedExcludeRule === true) {
    res.statusCode = 404;

    logger.silly(` - file doesn't exist on disk, and match exclusion`);
    logger.silly(` - statusCode: ${chalk.yellow(404)}`);
  }
  // 4.
  else if (isFileFoundOnDisk === true && isMatchedExcludeRule === false) {
    rewriteUrl = navigationFallback.rewrite;

    logger.silly(` - file exists on disk, and doesn't match exclusion`);
    logger.silly(` - url: ${chalk.yellow(rewriteUrl)}`);
  }
  // 5.
  else if (isFileFoundOnDisk === false && isMatchedExcludeRule === false) {
    rewriteUrl = navigationFallback.rewrite;

    logger.silly(` - file doesn't exist on disk, and doesn't match exclusion`);
    logger.silly(` - url: ${chalk.yellow(rewriteUrl)}`);
  }

  req.url = rewriteUrl;
  return true;
}

export function isRequestPathExcludedFromNavigationFallback(
  normalizedDecodedRequestPath: string | undefined,
  navigationFallback: SWAConfigFileNavigationFallback | undefined,
  matchedRoute: SWAConfigFileRoute | undefined
) {
  logger.silly(`checking if request is excluded from navigation fallback`);
  logger.silly(` - request: ${chalk.yellow(normalizedDecodedRequestPath)}`);

  const excludedPathRules = navigationFallback?.exclude;

  if (!normalizedDecodedRequestPath || excludedPathRules?.length === 0) {
    logger.silly(` - exclude: ${chalk.yellow(false)}`);
    return false;
  }

  const isMatchedExcludeRule = excludedPathRules?.some((filter) => {
    // override the route with the current filter rule
    const excludedPath = {
      ...matchedRoute,
      route: filter,
    };

    logger.silly(` - excludedPath: ${chalk.yellow(filter)}`);

    return doesRequestPathMatchRoute(normalizedDecodedRequestPath, excludedPath, null, null, AUTH_STATUS.NoAuth);
  });

  if (isMatchedExcludeRule) {
    logger.silly(` - don't rewrite ${chalk.yellow(normalizedDecodedRequestPath)}`);
  } else {
    logger.silly(` - rewrite ${chalk.yellow(normalizedDecodedRequestPath)} to ${chalk.yellow(navigationFallback?.rewrite)}`);
  }

  return isMatchedExcludeRule;
}
