import chalk from "chalk";
import type http from "http";
import { logger } from "../../../core/utils/logger.js";
import { CUSTOM_URL_SCHEME, OVERRIDABLE_ERROR_CODES } from "../../../core/constants.js";

function tryGetResponseOverrideForStatusCode(responseOverrides: SWAConfigFileResponseOverrides | undefined, statusCode: number) {
  return responseOverrides?.[statusCode];
}

// See: https://docs.microsoft.com/azure/static-web-apps/configuration#response-overrides
export function responseOverrides(req: http.IncomingMessage, res: http.ServerResponse, responseOverrides: SWAConfigFileResponseOverrides) {
  const statusCode = res.statusCode;

  logger.silly(`checking response overrides for status code ${chalk.yellow(statusCode)}`);
  if (OVERRIDABLE_ERROR_CODES.includes(statusCode)) {
    const rule = tryGetResponseOverrideForStatusCode(responseOverrides, statusCode);

    if (rule) {
      logger.silly(" - found overriden rules...");

      if (rule.statusCode) {
        res.statusCode = rule.statusCode;

        logger.silly(` - statusCode: ${chalk.yellow(statusCode)}`);
      }

      if (rule.redirect) {
        const statusCodeToServe = parseInt(`${rule?.statusCode}`, 10) === 301 ? 301 : 302;
        res.statusCode = statusCodeToServe;

        if (rule.redirect.indexOf(".referrer") !== -1) {
          // The Production SWA service supports replacing `.referrer` with the current route, so that the user can redirected to a deep link after the authentication flow.
          // Since the route can contain a path with a query we will want to encode it and the `auth.html` page will need to decode it before changing the page.
          const redirectWithReferrerReplaced = rule.redirect.replace(".referrer", encodeURIComponent(req.url || ""));
          res.setHeader("Location", redirectWithReferrerReplaced);
        } else {
          // No `.referrer` param is used, just use user-provided rule redirect as-is
          res.setHeader("Location", rule.redirect);
        }

        logger.silly(` - redirect: ${chalk.yellow(rule.redirect)}`);
      }
      if (rule.rewrite && req.url !== rule.rewrite) {
        // don't process .auth or api rewrites
        if (rule.rewrite.startsWith("/.auth") || rule.rewrite.startsWith("/api")) {
          return;
        }

        rule.rewrite = rule.rewrite.replace("/", "");
        req.url = `${CUSTOM_URL_SCHEME}${rule.rewrite}`;

        logger.silly(` - rewrite: ${chalk.yellow(req.url)}`);
      }
    } else {
      logger.silly(" - no rules found.");
    }
  }
}
