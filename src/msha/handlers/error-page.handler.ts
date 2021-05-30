import type http from "http";
import { logRequest } from "../../core";
import { SWA_CLI_APP_PROTOCOL } from "../../core/constants";
import { responseOverrides } from "../routes-engine";
import { isCustomUrl } from "../routes-engine/route-processor";

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
