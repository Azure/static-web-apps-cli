import http from "http";
import { DEFAULT_CONFIG } from "../../../config";
import { logger } from "../../../core";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#response-overrides
export const responseOverrides = async (req: http.IncomingMessage, res: http.ServerResponse, responseOverrides: SWAConfigFileResponseOverrides) => {
  const statusCode = res.statusCode;

  if ([400, 401, 403, 404].includes(statusCode)) {
    const overridenStatusCode = responseOverrides?.[`${statusCode}`];

    if (overridenStatusCode) {
      logger.silly("checking responseOverrides rule...");

      if (overridenStatusCode.statusCode) {
        res.statusCode = overridenStatusCode.statusCode;

        logger.silly(` - statusCode: ${statusCode}`);
      }
      if (overridenStatusCode.redirect) {
        res.setHeader("Location", overridenStatusCode.redirect);

        logger.silly(` - Location: ${overridenStatusCode.redirect}`);
      }
      if (overridenStatusCode.rewrite && req.url !== overridenStatusCode.rewrite) {
        req.url = `${DEFAULT_CONFIG.customUrlScheme}${overridenStatusCode.rewrite}`;

        logger.silly(` - url: ${req.url}`);
      }
    }
  }
};
