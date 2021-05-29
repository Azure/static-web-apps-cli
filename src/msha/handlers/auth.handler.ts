import type http from "http";
import { logger, logRequest } from "../../core";
import { processAuth } from "../auth";
import { pageNotFoundResponse, unauthorizedResponse } from "./error-page.handler";
export async function handleAuthRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  matchedRoute: SWAConfigFileRoute | undefined,
  userConfig: SWAConfigFile | undefined
) {
  logger.silly(`processing auth request...`);
  const statusCode = await processAuth(req, res, matchedRoute?.rewrite);
  if (statusCode === 404) {
    logger.silly(` - auth returned 404`);

    pageNotFoundResponse(req, res, userConfig?.responseOverrides);
  }

  logRequest(req, null, statusCode);
}

export function getAuthBlockResponse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  userConfig: SWAConfigFile | undefined,
  matchingRoute: SWAConfigFileRoute
) {
  switch (matchingRoute.statusCode) {
    case 404:
      return pageNotFoundResponse(req, res, userConfig?.responseOverrides);
    case 401:
      return unauthorizedResponse(req, res, userConfig?.responseOverrides);
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

export function isLoginRequest(requestPath: string | null) {
  return !!requestPath?.startsWith("/.auth/login");
}

export function isLogoutRequest(requestPath: string | null) {
  return !!requestPath?.startsWith("/.auth/logout");
}
