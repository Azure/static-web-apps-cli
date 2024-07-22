import type http from "node:http";
import { logger, logRequest } from "../../core/utils/logger.js";
import { processAuth } from "../auth/index.js";
import { handleErrorPage } from "./error-page.handler.js";

export async function handleAuthRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  matchedRoute: SWAConfigFileRoute | undefined,
  userConfig: SWAConfigFile | undefined
) {
  logger.silly(`processing auth request`);
  const statusCode = await processAuth(req, res, matchedRoute?.rewrite, userConfig?.auth);
  if (statusCode >= 400) {
    logger.silly(` - auth returned ${statusCode}`);
  }

  logRequest(req, "", statusCode);
}

export function getAuthBlockResponse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  userConfig: SWAConfigFile | undefined,
  matchingRoute: SWAConfigFileRoute
) {
  switch (matchingRoute.statusCode) {
    case 404:
      return handleErrorPage(req, res, 404, userConfig?.responseOverrides);
    case 401:
      return handleErrorPage(req, res, 401, userConfig?.responseOverrides);
    case 403:
      return handleErrorPage(req, res, 403, userConfig?.responseOverrides);
    default:
      break;
  }

  // Return status code according to route
  res.statusCode = Number(matchingRoute.statusCode) || 404;
  return;
}

export function isAuthRequest(req: http.IncomingMessage) {
  return !!(req.headers.host?.includes("identity") || req.url?.startsWith("/.auth"));
}

export function isLoginRequest(requestPath: string | undefined) {
  return !!requestPath?.startsWith("/.auth/login");
}

export function isLogoutRequest(requestPath: string | undefined) {
  return !!requestPath?.startsWith("/.auth/logout");
}
