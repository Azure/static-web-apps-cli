import http from "http";
import { DEFAULT_CONFIG } from "../../../config";
import { logger } from "../../../core";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#response-overrides
export const responseOverrides = async (req: http.IncomingMessage, res: http.ServerResponse, responseOverrides: SWAConfigFileResponseOverrides) => {
  const statusCode = res.statusCode;
  logger.silly(`checking responseOverrides rule for code = ${statusCode}...`);

  if (DEFAULT_CONFIG.overridableErrorCode?.includes(statusCode)) {
    const overridenStatusCode = responseOverrides?.[`${statusCode}`];

    if (overridenStatusCode) {
      logger.silly("found overriden rules...");

      if (overridenStatusCode.statusCode) {
        res.statusCode = overridenStatusCode.statusCode;

        logger.silly(` - statusCode: ${statusCode}`);
      }
      if (overridenStatusCode.redirect) {
        res.setHeader("Location", overridenStatusCode.redirect);

        logger.silly(` - Location: ${overridenStatusCode.redirect}`);
      }
      if (overridenStatusCode.rewrite && req.url !== overridenStatusCode.rewrite) {
        overridenStatusCode.rewrite = overridenStatusCode.rewrite.replace("/", "");
        req.url = `${DEFAULT_CONFIG.customUrlScheme}${overridenStatusCode.rewrite}`;

        logger.silly(` - url: ${req.url}`);
      }
    }
  } else {
    logger.silly(`status code out of range. skipping...`);
  }
};
