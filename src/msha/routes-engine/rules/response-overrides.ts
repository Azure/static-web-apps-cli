import chalk from "chalk";
import type http from "http";
import { DEFAULT_CONFIG } from "../../../config";
import { logger } from "../../../core";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#response-overrides
export function responseOverrides(req: http.IncomingMessage, res: http.ServerResponse, responseOverrides: SWAConfigFileResponseOverrides) {
  const statusCode = res.statusCode;

  logger.silly(`checking response overrides for status code ${chalk.yellow(statusCode)}...`);
  if (DEFAULT_CONFIG.overridableErrorCode?.includes(statusCode)) {
    const rule = responseOverrides?.[`${statusCode}`];

    if (rule) {
      logger.silly(" - found overriden rules...");

      if (rule.statusCode) {
        res.statusCode = rule.statusCode;

        logger.silly(` - statusCode: ${chalk.yellow(statusCode)}`);
      }
      if (rule.redirect) {
        res.setHeader("Location", rule.redirect);

        logger.silly(` - redirect: ${chalk.yellow(rule.redirect)}`);
      }
      if (rule.rewrite && req.url !== rule.rewrite) {
        // don't process .auth or api rewrites
        if (rule.rewrite.startsWith("/.auth") || rule.rewrite.startsWith("/api")) {
          return;
        }

        rule.rewrite = rule.rewrite.replace("/", "");
        req.url = `${DEFAULT_CONFIG.customUrlScheme}${rule.rewrite}`;

        logger.silly(` - rewrite: ${chalk.yellow(req.url)}`);
      }
    } else {
      logger.silly(" - no rules found.");
    }
  }
}
