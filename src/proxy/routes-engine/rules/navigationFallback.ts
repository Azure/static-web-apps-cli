import http from "http";
import fs from "fs";
import path from "path";
import globalyzer from "globalyzer";
import globrex from "globrex";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#fallback-routes

export const navigationFallback = async (
  req: http.IncomingMessage,
  _res: http.ServerResponse,
  navigationFallback: SWAConfigFileNavigationFallback
) => {
  let originlUrl = req.url;

  // don't process .auth or api requests
  if (originlUrl?.startsWith("/.auth") || originlUrl?.startsWith("/api")) {
    return;
  }

  // exit if no rewrite rule provided
  if (!navigationFallback.rewrite) {
    return;
  }

  // make sure we have a leading / in the URL
  if (navigationFallback.rewrite.startsWith("/") === false) {
    navigationFallback.rewrite = `/${navigationFallback.rewrite}`;
  }

  // is the requested file available on disk?
  const filename = originlUrl?.endsWith("/") ? `${originlUrl}/index.html` : originlUrl;
  console.log({ originlUrl, filename });

  const filepath = path.join(process.env.SWA_CLI_APP_ARTIFACT_LOCATION!, filename!);

  const isFileFoundOnDisk = fs.existsSync(filepath);

  // parse the exclusion rules and match at least one rule
  const isMatchedFilter = navigationFallback.exclude.some((filter) => {
    // we don't support full globs in the config file.
    // add this little workaround to convert a wildcard into a valid glob pattern
    filter = filter.replace("/*", "/**/*");

    // extract glob metadata
    const globSegments = globalyzer(filter);

    if (originlUrl?.startsWith(globSegments.base)) {
      const { regex } = globrex(globSegments.glob, { globstar: true, extended: true });

      // extract the last segment (what comes after the base) from the URL:
      // /                    => <empty string>
      // /bar.gif             => bar.gif
      // /images/foo/bar.gif  => bar.gif
      let lastSegmentFromUrl = originlUrl.replace(`${globSegments.base}`, "");

      // globrex generates regex that doesn't match leading forwardslash, so we remove it
      // before processing the regex
      lastSegmentFromUrl = lastSegmentFromUrl.replace(/^\//, "");

      return regex.test(lastSegmentFromUrl!);
    } else {
      return false;
    }
  });

  // rules logic:
  // if no exclude rules are provided, rewrite by default
  // if a file exists on disk, and match exclusion => return it
  // if a file doesn't exist on disk, and match exclusion => 404
  // if a file exists on disk, and doesn't match exclusion => /index.html
  // if a file doesn't exist on disk, and doesn't match exclusion => /index.html
  let newUrl = req.url;
  if (!navigationFallback.exclude || navigationFallback.exclude.length === 0) {
    newUrl = navigationFallback.rewrite;
  } else if (isFileFoundOnDisk === true && isMatchedFilter === true) {
    newUrl = req.url;
  } else if (isFileFoundOnDisk === false && isMatchedFilter === true) {
    newUrl = req.url;
  } else if (isFileFoundOnDisk === true && isMatchedFilter === false) {
    newUrl = navigationFallback.rewrite;
  } else if (isFileFoundOnDisk === false && isMatchedFilter === false) {
    newUrl = navigationFallback.rewrite;
  }

  req.url = newUrl;
};
