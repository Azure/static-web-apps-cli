import fs from "fs";
// import globalyzer from "globalyzer";
// import globrex from "globrex";
import http from "http";
import path from "path";
import { logger } from "../../../core";
import { globToRegExp } from "../../../core/utils/glob";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#fallback-routes

export const navigationFallback = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  navigationFallback: SWAConfigFileNavigationFallback
) => {
  let originlUrl = req.url;

  // don't process .auth or api requests
  if (originlUrl?.startsWith("/.auth") || originlUrl?.startsWith("/api")) {
    return;
  }

  // exit if no rewrite rule provided
  if (!navigationFallback?.rewrite) {
    return;
  }

  logger.silly("checking navigationFallback rule...");

  // make sure we have a leading / in the URL
  if (navigationFallback.rewrite.startsWith("/") === false) {
    navigationFallback.rewrite = `/${navigationFallback.rewrite}`;
  }

  // is the requested file available on disk?
  const filename = originlUrl?.endsWith("/") ? `${originlUrl}/index.html` : originlUrl;
  const filepath = path.join(process.env.SWA_CLI_OUTPUT_LOCATION!, filename!);
  const isFileFoundOnDisk = fs.existsSync(filepath);

  logger.silly(` - url ${originlUrl}`);

  // parse the exclusion rules and match at least one rule
  const isMatchedFilter = navigationFallback?.exclude.some((filter) => {
    // we don't support full globs in the config file.
    // add this little utility to convert a wildcard into a valid glob pattern
    const regexp = new RegExp(`^${globToRegExp(filter)}$`);
    const isMatch = regexp.test(originlUrl!);

    logger.silly(`   - filter= ${filter}`);
    logger.silly(`   -  regexp= ${regexp}`);
    logger.silly(`   -  match= ${isMatch}`);

    return isMatch;
  });

  logger.silly(` - isMatchedFilter=${isMatchedFilter}`);

  // rules logic:
  // 1. if no exclude rules are provided, rewrite by default
  // 2. if a file exists on disk, and match exclusion => return it
  // 3. if a file doesn't exist on disk, and match exclusion => 404
  // 4. if a file exists on disk, and doesn't match exclusion => /index.html
  // 5. if a file doesn't exist on disk, and doesn't match exclusion => /index.html

  // note: given the complexity of all possible combinations, don't refactor the code below
  let newUrl = req.url;
  // 1.
  if (!navigationFallback.exclude || navigationFallback.exclude.length === 0) {
    newUrl = navigationFallback.rewrite;

    logger.silly(` - no exclude rules are provided (rewrite by default)`);
    logger.silly(` - url=${newUrl}`);
  }
  // 2.
  else if (isFileFoundOnDisk === true && isMatchedFilter === true) {
    newUrl = req.url;

    logger.silly(` - file exists on disk, and match exclusion`);
    logger.silly(` - url=${newUrl}`);
  }
  // 3.
  else if (isFileFoundOnDisk === false && isMatchedFilter === true) {
    res.statusCode = 404;

    logger.silly(` - file doesn't exist on disk, and match exclusion`);
    logger.silly(` - statusCode=404`);
  }
  // 4.
  else if (isFileFoundOnDisk === true && isMatchedFilter === false) {
    newUrl = navigationFallback.rewrite;

    logger.silly(` - file exists on disk, and doesn't match exclusion`);
    logger.silly(` - url=${newUrl}`);
  }
  // 5.
  else if (isFileFoundOnDisk === false && isMatchedFilter === false) {
    newUrl = navigationFallback.rewrite;

    logger.silly(` - file doesn't exist on disk, and doesn't match exclusion`);
    logger.silly(` - url=${newUrl}`);
  }

  req.url = newUrl;
};
