import type http from "http";
import { logRequest } from "../../core";
import { SWA_CLI_APP_PROTOCOL } from "../../core/constants";
import { responseOverrides } from "../routes-engine";

export function pageNotFoundResponse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  responseOverridesRule: SWAConfigFileResponseOverrides | undefined
) {
  res.setHeader("Content-Type", "text/html");
  res.statusCode = 404;

  if (responseOverridesRule) {
    responseOverrides(req, res, responseOverridesRule);
  } else {
    req.url = "/404.html";
  }
  logRequest(req, SWA_CLI_APP_PROTOCOL + "://" + req.headers.host, 404);

  // Note: do not terminate connection (res.end()).
  // The 404 flow needs to be propagated to serve-static
}

export function unauthorizedResponse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  responseOverridesRule: SWAConfigFileResponseOverrides | undefined
) {
  res.setHeader("ContentType", "text/html");
  res.statusCode = 401;

  if (responseOverridesRule) {
    responseOverrides(req, res, responseOverridesRule);
  } else {
    req.url = "/401.html";
  }

  logRequest(req, SWA_CLI_APP_PROTOCOL + "://" + req.headers.host, 401);

  // Note: we need to terminate connection to return the 401 page right away.
  res.end();
}
