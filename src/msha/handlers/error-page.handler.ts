import type http from "node:http";
import { logRequest } from "../../core/utils/logger.js";
import { SWA_CLI_APP_PROTOCOL } from "../../core/constants.js";
import { responseOverrides } from "../routes-engine/rules/response-overrides.js";
import { isCustomUrl } from "../routes-engine/route-processor.js";

export function handleErrorPage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  statusCode: number,
  responseOverridesRule: SWAConfigFileResponseOverrides | undefined
) {
  res.setHeader("ContentType", "text/html");

  // status code must be set before checking for overrides!
  res.statusCode = statusCode;

  if (responseOverridesRule) {
    responseOverrides(req, res, responseOverridesRule);
  }

  if (!isCustomUrl(req)) {
    req.url = `/${statusCode}.html`;
  }

  logRequest(req, SWA_CLI_APP_PROTOCOL + "://" + req.headers.host, statusCode);
}
