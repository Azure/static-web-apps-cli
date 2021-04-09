// The routes engine implemetation is (and should always be) aligned with the documentation
// see: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration

import fs from "fs";
import { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { logger } from "../../core";
import { customRoutes, matchRoute } from "./rules/customRoutes";
import { globalHeaders } from "./rules/globalHeaders";
import { mimeTypes } from "./rules/mimeTypes";
import { navigationFallback } from "./rules/navigationFallback";
import { responseOverrides } from "./rules/responseOverrides";

/**
 * The order in which the following are applied are:
 * 1. Request comes in, a route rule that applies to the request is searched for
 * 2. If content to serve does not exist, navigation fallback is specified, and the request isn't excluded from navigation fallback, then serve navigation fallback content
 * 3. If content to serve does exist, apply headers to page, and apply mime type (either default or custom)
 * 4. At any point in 1-3 if there is a reason to throw an error response (401, 403, 404) and response overrides are specified than those values are served
 */
export async function applyRules(req: IncomingMessage, res: ServerResponse, userConfig: SWAConfigFile) {
  const userDefinedRoute = userConfig.routes?.find(matchRoute(req, userConfig.isLegacyConfigFile));
  const filepath = path.join(process.env.SWA_CLI_OUTPUT_LOCATION!, req.url!);
  const isFileFound = fs.existsSync(filepath);

  // note: these rules are mutating the req and res objects

  await navigationFallback(req, res, userConfig.navigationFallback);

  await globalHeaders(req, res, userConfig.globalHeaders);
  await mimeTypes(req, res, userConfig.mimeTypes);

  await customRoutes(req, res, userDefinedRoute);
  await responseOverrides(req, res, userConfig.responseOverrides);

  logger.silly({
    outputLocation: process.env.SWA_CLI_OUTPUT_LOCATION,
    matchedRoute: userDefinedRoute,
    filepath,
    isFileFound,
    statusCode: res.statusCode,
    url: req.url,
  });
}
