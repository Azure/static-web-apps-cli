import chalk from "chalk";
import finalhandler from "finalhandler";
import fs from "fs";
import type http from "http";
import httpProxy from "http-proxy";
import type net from "net";
import path from "path";
import serveStatic from "serve-static";
import { DEFAULT_CONFIG } from "../../config";
import { findSWAConfigFile, logger, logRequest } from "../../core";
import { getAuthBlockResponse, handleAuthRequest, isAuthRequest, isLoginRequest, isLogoutRequest } from "../handlers/auth.handler";
import { AUTH_STATUS, IS_APP_DEV_SERVER, SWA_CLI_APP_PROTOCOL, SWA_CLI_OUTPUT_LOCATION, SWA_PUBLIC_DIR } from "../../core/constants";
import { unauthorizedResponse } from "../handlers/error-page.handler";
import { isFunctionRequest } from "../handlers/function.handler";
import { getResponse } from "./response.middleware";
import { isRequestMethodValid, isRouteRequiringUserRolesCheck, tryGetMatchingRoute } from "../routes-engine";

export function onConnectionLost(req: http.IncomingMessage, res: http.ServerResponse | net.Socket, target: string) {
  return (error: Error) => {
    if (error.message.includes("ECONNREFUSED")) {
      const statusCode = 502;
      (res as http.ServerResponse).statusCode = statusCode;
      const uri = `${target}${req.url}`;
      logger.error(`${req.method} ${uri} - ${statusCode} (Bad Gateway)`);
    } else {
      logger.error(`${error.message}`);
    }
    logger.silly({ error });
    res.end();
  };
}

export async function handleUserConfig(appLocation: string): Promise<SWAConfigFile | undefined> {
  if (!fs.existsSync(appLocation)) {
    return;
  }

  const configFile = await findSWAConfigFile(appLocation);
  if (!configFile) {
    return;
  }

  let configJson: SWAConfigFile | undefined;
  try {
    configJson = require(configFile.file) as SWAConfigFile;
    configJson.isLegacyConfigFile = configFile.isLegacyConfigFile;

    logger.info(`\nFound configuration file:\n    ${chalk.green(configFile.file)}`);

    if (configFile.isLegacyConfigFile) {
      logger.info(
        `    ${chalk.yellow(`WARNING: Functionality defined in the routes.json file is now deprecated.`)}\n` +
          `    ${chalk.yellow(`Read more: https://docs.microsoft.com/azure/static-web-apps/configuration#routes`)}`
      );
    }

    return configJson;
  } catch (error) {
    logger.silly(`${chalk.red("configuration file is invalid!")}`);
    logger.silly(`${chalk.red(error.toString())}`);
  }

  return configJson;
}

function handleStaticFileResponse(req: http.IncomingMessage, res: http.ServerResponse) {
  logger.silly(`checking static content...`);

  let target = SWA_CLI_OUTPUT_LOCATION;

  const isCustomUrl = req.url?.startsWith(DEFAULT_CONFIG.customUrlScheme!);
  logger.silly(` - isCustomUrl: ${chalk.yellow(isCustomUrl)}`);

  if (isCustomUrl) {
    // extract user custom page filename
    req.url = req.url?.replace(DEFAULT_CONFIG.customUrlScheme!, "");
    target = SWA_CLI_OUTPUT_LOCATION;
  } else {
    if (DEFAULT_CONFIG.overridableErrorCode?.includes(res.statusCode)) {
      target = SWA_PUBLIC_DIR;
    }
  }

  logger.silly(` - url: ${chalk.yellow(req.url)}`);
  logger.silly(` - target: ${chalk.yellow(target)}`);

  return {
    target,
  };
}

function serveStaticFileReponse(req: http.IncomingMessage, res: http.ServerResponse, proxyApp: httpProxy, target: string) {
  // is this a dev server?
  if (IS_APP_DEV_SERVER()) {
    proxyApp.web(
      req,
      res,
      {
        target,
        secure: false,
        toProxy: true,
      },
      onConnectionLost(req, res, target)
    );
    proxyApp.once("proxyRes", (proxyRes: http.IncomingMessage, req: http.IncomingMessage) => {
      logRequest(req, null, proxyRes.statusCode);
    });
  } else {
    // run one last check beforing serving 404 page:
    // if the requested file is not foud on disk
    // send our SWA 404 default page instead of serve-static's one.
    const file = path.join(target, req.url!);
    if (fs.existsSync(file) === false) {
      req.url = "404.html";
      res.statusCode = 404;
      target = SWA_PUBLIC_DIR;
    }

    logger.silly(`serving static content...`);
    logger.silly({ file, url: req.url, code: res.statusCode });

    const onerror = (err: any) => console.error(err);
    const done = finalhandler(req, res, { onerror }) as any;
    serveStatic(target, { extensions: ["html"] })(req, res, done);
  }
}

export async function requestMiddleware(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  proxyApp: httpProxy,
  userConfig: SWAConfigFile | undefined
) {
  if (!req.url) {
    return;
  }

  logger.silly(`--------------------------------------------------------`);
  logger.silly(`------------------- processing route -------------------`);
  logger.silly(`processing URL ${chalk.yellow(req.url)}`);

  let authStatus = AUTH_STATUS.NoAuth;
  const isAuthReq = isAuthRequest(req);

  logger.silly(`checking for matching route...`);
  const matchingRouteRule = tryGetMatchingRoute(req, userConfig);
  if (matchingRouteRule) {
    logger.silly({ matchingRouteRule });
  }

  logger.silly(`checking is auth request...`);
  if (isAuthReq) {
    logger.silly(` - auth request detected.`);
    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  } else {
    logger.silly(` - not an auth request.`);
  }

  logger.silly(`checking is functions request...`);
  const isFunctionReq = isFunctionRequest(req, matchingRouteRule?.rewrite);

  if (!isRequestMethodValid(req, isFunctionReq, isAuthReq)) {
    res.statusCode = 405;
    return res.end();
  }

  logger.silly(`checking for query params...`);

  const isMatchingRewriteRoute = matchingRouteRule?.rewrite;
  const sanitizedUrl = new URL(isMatchingRewriteRoute!, `${SWA_CLI_APP_PROTOCOL}://${req?.headers?.host}`);
  const matchingRewriteRouteQueryString = sanitizedUrl.searchParams.toString();
  const doesMatchingRewriteRouteHaveQueryStringParameters = matchingRewriteRouteQueryString !== "";
  let matchingRewriteRoutePath = isMatchingRewriteRoute ? isMatchingRewriteRoute : null;
  if (doesMatchingRewriteRouteHaveQueryStringParameters) {
    matchingRewriteRoutePath = sanitizedUrl.pathname;
    logger.silly(` - query: ${chalk.yellow(matchingRewriteRouteQueryString)}`);
  }

  logger.silly(`checking is rewrite auth login request (${chalk.yellow(matchingRewriteRoutePath)})...`);
  if (isMatchingRewriteRoute && isLoginRequest(matchingRewriteRoutePath)) {
    logger.silly(` - auth login dectected.`);

    authStatus = AUTH_STATUS.HostNameAuthLogin;
    req.url = sanitizedUrl.toString();
    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  }

  logger.silly(`checking is rewrite auth logout request (${chalk.yellow(matchingRewriteRoutePath)})...`);
  if (isMatchingRewriteRoute && isLogoutRequest(matchingRewriteRoutePath)) {
    logger.silly(` - auth logout dectected.`);

    authStatus = AUTH_STATUS.HostNameAuthLogout;
    req.url = sanitizedUrl.toString();
    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  }

  if (!isRouteRequiringUserRolesCheck(req, matchingRouteRule, isFunctionReq, authStatus)) {
    unauthorizedResponse(req, res, userConfig?.responseOverrides);
  }

  if (authStatus != AUTH_STATUS.NoAuth && (authStatus != AUTH_STATUS.HostNameAuthLogin || !isMatchingRewriteRoute)) {
    if (authStatus == AUTH_STATUS.HostNameAuthLogin && matchingRouteRule) {
      return getAuthBlockResponse(req, res, userConfig, matchingRouteRule);
    }

    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  }

  getResponse(req, res, matchingRouteRule, userConfig, isFunctionReq);

  if (!isFunctionReq) {
    const { target } = handleStaticFileResponse(req, res);
    serveStaticFileReponse(req, res, proxyApp, target);
  }
}
