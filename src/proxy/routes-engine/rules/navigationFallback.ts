import fs from "fs";
import globalyzer from "globalyzer";
import globrex from "globrex";
import http from "http";
import path from "path";
import { logger } from "../../../core";

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

  // make sure we have a leading / in the URL
  if (navigationFallback.rewrite.startsWith("/") === false) {
    navigationFallback.rewrite = `/${navigationFallback.rewrite}`;
  }

  // is the requested file available on disk?
  const filename = originlUrl?.endsWith("/") ? `${originlUrl}/index.html` : originlUrl;

  const filepath = path.join(process.env.SWA_CLI_OUTPUT_LOCATION!, filename!);

  const isFileFoundOnDisk = fs.existsSync(filepath);

  // parse the exclusion rules and match at least one rule
  const isMatchedFilter = navigationFallback.exclude.some((filter) => {
    // we don't support full globs in the config file.
    // add this little workaround to convert a wildcard into a valid glob pattern
    filter = filter.replace("*", "**/*");

    // extract glob metadata
    const globSegments = globalyzer(filter);

    const { regex } = globrex(globSegments.glob, { globstar: true, extended: true, filepath: true });

    // globrex generates regex that doesn't match leading forwardslash, so we remove it
    // before processing the regex
    let originlUrlWithoutLeadingSlash = originlUrl?.replace(/^\//, "");

    return regex.test(originlUrlWithoutLeadingSlash!);
  });

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
  }
  // 2.
  else if (isFileFoundOnDisk === true && isMatchedFilter === true) {
    newUrl = req.url;
  }
  // 3.
  else if (isFileFoundOnDisk === false && isMatchedFilter === true) {
    res.statusCode = 404;
  }
  // 4.
  else if (isFileFoundOnDisk === true && isMatchedFilter === false) {
    newUrl = navigationFallback.rewrite;
  }
  // 5.
  else if (isFileFoundOnDisk === false && isMatchedFilter === false) {
    newUrl = navigationFallback.rewrite;
  }

  logger.silly({ filepath, isMatchedFilter });
  req.url = newUrl;
};
