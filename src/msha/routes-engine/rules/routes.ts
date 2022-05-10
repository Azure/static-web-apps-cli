import chalk from "chalk";
import fs from "fs";
import type http from "http";
import path from "path";
import { DEFAULT_CONFIG } from "../../../config";
import { decodeCookie, logger } from "../../../core";
import { ALLOWED_HTTP_METHODS_FOR_STATIC_CONTENT, AUTH_STATUS, SWA_CLI_APP_PROTOCOL } from "../../../core/constants";
import { isAuthRequest } from "../../handlers/auth.handler";
import { doesRequestPathMatchLegacyRoute, doesRequestPathMatchRoute } from "../route-processor";

export function tryFindFileForRequest(rawRequestPath: string) {
  logger.silly(`finding file for request`);

  // percent decode request path
  let requestPath = decodeURIComponent(rawRequestPath);
  if (requestPath.endsWith("/")) {
    requestPath = getIndexHtml(requestPath);
  }

  logger.silly(` - requestPath: ${chalk.yellow(requestPath)}`);

  if (DEFAULT_CONFIG.outputLocation) {
    const filePath = path.join(DEFAULT_CONFIG.outputLocation, requestPath!);
    logger.silly(` - filePath: ${chalk.yellow(filePath)}`);
    const isFileExists = fs.existsSync(filePath);
    logger.silly(` - exists: ${chalk.yellow(isFileExists)}`);
    return isFileExists ? requestPath : null;
  }

  return null;
}

export function isRouteRequiringUserRolesCheck(
  req: http.IncomingMessage,
  matchingRoute: SWAConfigFileRoute | undefined,
  isFunctionRequest: boolean,
  authStatus: number
) {
  logger.silly(`checking authorizations for route`);

  if (!matchingRoute) {
    logger.silly(` - no matching rule`);
    logger.silly(` - access authorized`);
    return true;
  }

  if (matchingRoute.allowedRoles?.length === 0) {
    logger.silly(` - no allowedRoles provided`);
    logger.silly(` - access authorized`);
    return true;
  }

  const shouldCheckRoles = Boolean(
    authStatus != AUTH_STATUS.HostNameAuthLogin &&
      matchingRoute.allowedRoles &&
      matchingRoute.allowedRoles.length > 0 &&
      !matchingRoute.allowedRoles.includes("anonymous")
  );

  logger.silly(` - shouldCheckRoles: ${chalk.yellow(shouldCheckRoles)}`);

  const shouldLookupAuthCookie =
    shouldCheckRoles || isFunctionRequest || authStatus == AUTH_STATUS.AuthMe || authStatus == AUTH_STATUS.HostNameAuthPurge;

  logger.silly(` - shouldLookupAuthCookie: ${chalk.yellow(shouldLookupAuthCookie)}`);

  if (shouldLookupAuthCookie) {
    const clientPrincipalInternal = req.headers?.cookie ? decodeCookie(req.headers?.cookie) : null;
    const doesAuthCookieExist = !!clientPrincipalInternal;

    if (shouldCheckRoles && !doesAuthCookieExist) {
      logger.silly(` - secure route found but cookies not found`);
      logger.silly(` - access not authorized`);
      return false;
    }

    const userRoles = clientPrincipalInternal?.userRoles;
    logger.silly(` - userRoles: ${chalk.yellow(userRoles?.length ? userRoles : "<empty>")}`);
    logger.silly(` - allowedRoles: ${chalk.yellow(matchingRoute.allowedRoles)}`);
    logger.silly(matchingRoute);

    const matchedRoles = userRoles?.filter((value) => matchingRoute.allowedRoles?.includes(value));
    logger.silly(` - matchedRoles: ${chalk.yellow(matchedRoles?.length ? matchedRoles : "<empty>")}`);

    const isUserAuthenticatedOrAnonymous = matchedRoles?.length! > 0;
    logger.silly(` - isUserAuthenticatedOrAnonymous: ${chalk.yellow(isUserAuthenticatedOrAnonymous)}`);

    if (shouldCheckRoles && !isUserAuthenticatedOrAnonymous) {
      logger.silly(` - secure route found but roles don't match`);
      logger.silly({ allowedRoles: matchingRoute.allowedRoles });
      logger.silly(` - access not authorized`);
      return false;
    }
  }

  logger.silly(` - access authorized`);
  return true;
}

export function applyRedirectResponse(req: http.IncomingMessage, res: http.ServerResponse, matchedRoute: SWAConfigFileRoute | undefined) {
  const redirect = matchedRoute?.redirect;

  if (redirect && redirect !== req.url) {
    const statusCodeToServe = parseInt(`${matchedRoute?.statusCode}`, 10) === 301 ? 301 : 302;
    res.statusCode = statusCodeToServe;
    res.setHeader("Location", redirect);
    logger.silly(` - will redirect to ${chalk.yellow(redirect)} (statusCode: ${chalk.yellow(statusCodeToServe)})`);
  }
}

export function tryGetMatchingRoute(req: http.IncomingMessage, userConfig: SWAConfigFile | undefined) {
  const host = `${SWA_CLI_APP_PROTOCOL}://${req?.headers?.host}`;
  const sanitizedUrl = new URL(req.url!, host);
  const requestPathFileExtension = path.extname(sanitizedUrl.toString());
  const isFileRequest = !!requestPathFileExtension;
  const requestMethod = req.method;
  const isLegacyConfigFile = userConfig?.isLegacyConfigFile;

  if (userConfig?.routes?.length === 0) {
    return;
  }

  let routeDef: SWAConfigFileRoute | undefined = undefined;

  for (let i = 0; i < userConfig?.routes?.length!; i++) {
    routeDef = userConfig?.routes[i];
    let route = routeDef?.route;

    if (!route) {
      // this is an invalid route, ignore it
      continue;
    }

    const isMatchingRoute = isLegacyConfigFile
      ? doesRequestPathMatchLegacyRoute(sanitizedUrl.pathname, routeDef, isAuthRequest(req), isFileRequest)
      : doesRequestPathMatchRoute(
          sanitizedUrl.pathname,
          routeDef,
          requestMethod,
          routeDef?.methods,
          AUTH_STATUS.NoAuth /* TODO get the right auth status */
        );

    if (isMatchingRoute) {
      // if the rule isn't a redirect rule, no need to check for circular redirect
      if (!routeDef?.redirect) {
        return routeDef;
      }

      // this rule will result in an infinite redirect loop so keep searching for another rule
      const redirectUrl = new URL(routeDef.redirect || "/", host);
      if (sanitizedUrl.toString() === redirectUrl.pathname || sanitizedUrl.toString() === redirectUrl.toString()) {
        continue;
      }

      routeDef = {
        ...routeDef,
        redirect: redirectUrl.toString(),
      };
      return routeDef;
    }
  }

  return;
}

export function isRequestMethodValid(req: http.IncomingMessage, isFunctionRequest: boolean, isAuth: boolean) {
  logger.silly(`checking HTTP method: ${chalk.yellow(req.method)}`);

  if (isFunctionRequest || isAuth) {
    logger.silly(` - function or auth request detected, method is valid`);
    return true;
  }

  if (ALLOWED_HTTP_METHODS_FOR_STATIC_CONTENT.includes(req.method!)) {
    logger.silly(` - method is valid (allow-list: ${chalk.yellow(ALLOWED_HTTP_METHODS_FOR_STATIC_CONTENT.join(","))})`);
    return true;
  }

  // Deny everything else
  logger.silly(` - method is invalid. Deny request`);
  return false;
}

export function getIndexHtml(requestPath: string | undefined) {
  // skip requests that contains file extensions
  if (requestPath?.toLocaleLowerCase().endsWith("index.html") || requestPath?.includes(".")) {
    return requestPath;
  }

  return requestPath?.endsWith("/") ? `${requestPath}index.html` : `${requestPath}/index.html`;
}
