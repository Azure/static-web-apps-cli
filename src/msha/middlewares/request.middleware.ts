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
import { AUTH_STATUS, CUSTOM_URL_SCHEME, IS_APP_DEV_SERVER, SWA_PUBLIC_DIR } from "../../core/constants";
import { getAuthBlockResponse, handleAuthRequest, isAuthRequest, isLoginRequest, isLogoutRequest } from "../handlers/auth.handler";
import { handleErrorPage } from "../handlers/error-page.handler";
import { isFunctionRequest } from "../handlers/function.handler";
import { isRequestMethodValid, isRouteRequiringUserRolesCheck, tryGetMatchingRoute } from "../routes-engine";
import { isCustomUrl, parseQueryParams } from "../routes-engine/route-processor";
import { getResponse } from "./response.middleware";

/**
 * On connection lost handler. Called when a connection to a target host cannot be made or if the remote target is down.
 * @param req Node.js HTTP request object.
 * @param res Node.js HTTP response object.
 * @param target The HTTP host target.
 * @returns A callback function including an Error object.
 */
export function onConnectionLost(req: http.IncomingMessage, res: http.ServerResponse | net.Socket, target: string | undefined, prefix = "") {
  prefix = prefix === "" ? prefix : ` ${prefix} `;
  return (error: Error) => {
    if (error.message.includes("ECONNREFUSED")) {
      const statusCode = 502;
      (res as http.ServerResponse).statusCode = statusCode;
      const uri = `${target}${req.url}`;
      logger.error(`${prefix}${req.method} ${uri} - ${statusCode} (Bad Gateway)`);
    } else {
      logger.error(`${error.message}`);
    }
    logger.silly({ error });
    res.end();
  };
}

/**
 *
 * @param appLocation The location of the application code, where the application configuration file is located.
 * @returns The JSON content of the application configuration file defined in the `staticwebapp.config.json` file (or legacy file `routes.json`).
 * If no configuration file is found, returns `undefined`.
 * @see https://docs.microsoft.com/azure/static-web-apps/configuration
 */
export async function handleUserConfig(appLocation: string | undefined): Promise<SWAConfigFile | undefined> {
  if (!appLocation || !fs.existsSync(appLocation)) {
    return;
  }

  const runtimeConfigContent = await findSWAConfigFile(appLocation);
  if (!runtimeConfigContent) {
    return;
  }

  return runtimeConfigContent.content;
}

/**
 * Serves static content or proxy requests to a static dev server (when used).
 * @param req Node.js HTTP request object.
 * @param res Node.js HTTP response object.
 * @param proxyApp An `http-proxy` instance.
 * @param target The root folder of the static app (ie. `output_location`). Or, the HTTP host target, if connecting to a dev server, or
 */
function serveStaticOrProxyResponse(req: http.IncomingMessage, res: http.ServerResponse, proxyApp: httpProxy, target: string | undefined) {
  if ([301, 302].includes(res.statusCode)) {
    res.end();
    return;
  }

  const customUrl = isCustomUrl(req);
  logger.silly(`customUrl: ${chalk.yellow(customUrl)}`);
  if (req.url?.includes("index.html") || customUrl) {
    // serve index.html or custom pages from user's `outputLocation`

    logger.silly(`custom page or index.html detected`);
    // extract user custom page filename
    req.url = req.url?.replace(CUSTOM_URL_SCHEME, "");
    target = DEFAULT_CONFIG.outputLocation;

    logger.silly(` - url: ${chalk.yellow(req.url)}`);
    logger.silly(` - statusCode: ${chalk.yellow(res.statusCode)}`);
    logger.silly(` - target: ${chalk.yellow(target)}`);
  }

  const is4xx = res.statusCode >= 400 && res.statusCode < 500;
  logger.silly(`is4xx: ${is4xx}`);

  // if the static app is served by a dev server, forward all requests to it.
  if (IS_APP_DEV_SERVER() && (!is4xx || customUrl)) {
    logger.silly(`remote dev server detected. Proxying request`);
    logger.silly(` - url: ${chalk.yellow(req.url)}`);
    logger.silly(` - code: ${chalk.yellow(res.statusCode)}`);

    target = DEFAULT_CONFIG.outputLocation;
    logRequest(req, target);

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
    proxyApp.once("proxyRes", (proxyRes: http.IncomingMessage) => {
      logger.silly(`getting response from dev server`);

      logRequest(req, target, proxyRes.statusCode);
    });
  } else {
    // not a dev server

    // run one last check before serving the page:
    // if the requested file is not found on disk
    // send our SWA 404 default page instead of serve-static's one.

    let file = null;
    let fileInOutputLocation = null;
    let existsInOutputLocation = false;
    target = DEFAULT_CONFIG.outputLocation as string;

    if (target) {
      fileInOutputLocation = path.join(target, req.url!);
      existsInOutputLocation = fs.existsSync(fileInOutputLocation);
      logger.silly(`checking if file exists in user's output location`);
      logger.silly(` - file: ${chalk.yellow(fileInOutputLocation)}`);
      logger.silly(` - exists: ${chalk.yellow(existsInOutputLocation)}`);
    }

    if (existsInOutputLocation === false) {
      // file doesn't exist in the user's `outputLocation`
      // check in the cli public dir
      target = SWA_PUBLIC_DIR;

      logger.silly(`checking if file exists in CLI public dir`);

      const fileInCliPublicDir = path.join(target, req.url!);
      const existsInCliPublicDir = fs.existsSync(fileInCliPublicDir);

      logger.silly(` - file: ${chalk.yellow(fileInCliPublicDir)}`);
      logger.silly(` - exists: ${chalk.yellow(existsInCliPublicDir)}`);

      if (existsInCliPublicDir === false) {
        req.url = "/404.html";
        res.statusCode = 404;
        target = SWA_PUBLIC_DIR;
      } else {
        file = fileInCliPublicDir;
      }
    } else {
      file = fileInOutputLocation;
    }

    logger.silly(`serving static content`);
    logger.silly({ file, url: req.url, code: res.statusCode });

    const onerror = (err: any) => console.error(err);
    const done = finalhandler(req, res, { onerror }) as any;

    // serving static content is only possible for GET requests
    req.method = "GET";
    serveStatic(target, { extensions: ["html"] })(req, res, done);
  }
}

/**
 * This functions runs a series of heuristics to determines if a request is a Websocket request.
 * @param req Node.js HTTP request object.
 * @returns True if the request is a Websocket request. False otherwise.
 */
function isWebsocketRequest(req: http.IncomingMessage) {
  // TODO: find a better way of guessing if this is a Websocket request
  const isSockJs = req.url?.includes("sockjs-node");
  const hasWebsocketHeader = req.headers.upgrade?.toLowerCase() === "websocket";
  return isSockJs || hasWebsocketHeader;
}

/**
 *
 * @param req Node.js HTTP request object.
 * @param res Node.js HTTP response object.
 * @param proxyApp An `http-proxy` instance.
 * @param userConfig The application configuration file defined in the `staticwebapp.config.json` file (or legacy file `routes.json`).
 * @returns This middleware mutates the `req` and `res` HTTP objects.
 */
export async function requestMiddleware(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  proxyApp: httpProxy,
  userConfig: SWAConfigFile | undefined
) {
  if (!req.url) {
    return;
  }

  logger.silly(``);
  logger.silly(`--------------------------------------------------------`);
  logger.silly(`------------------- processing route -------------------`);
  logger.silly(`--------------------------------------------------------`);
  logger.silly(`processing ${chalk.yellow(req.url)}`);

  if (isWebsocketRequest(req)) {
    logger.silly(`websocket request detected`);
    return serveStaticOrProxyResponse(req, res, proxyApp, DEFAULT_CONFIG.outputLocation);
  }

  let target = DEFAULT_CONFIG.outputLocation;

  logger.silly(`checking for matching route`);
  const matchingRouteRule = tryGetMatchingRoute(req, userConfig);
  if (matchingRouteRule) {
    logger.silly({ matchingRouteRule });

    const statusCodeToServe = parseInt(`${matchingRouteRule?.statusCode}`, 10);
    if ([404, 403, 401].includes(statusCodeToServe)) {
      logger.silly(` - ${statusCodeToServe} code detected. Exit`);

      handleErrorPage(req, res, statusCodeToServe, userConfig?.responseOverrides);
      return serveStaticOrProxyResponse(req, res, proxyApp, target);
    }
  }

  let authStatus = AUTH_STATUS.NoAuth;
  const isAuthReq = isAuthRequest(req);

  logger.silly(`checking auth request`);
  if (isAuthReq) {
    logger.silly(` - auth request detected`);
    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  } else {
    logger.silly(` - not an auth request`);
  }

  logger.silly(`checking function request`);
  const isFunctionReq = isFunctionRequest(req, matchingRouteRule?.rewrite);
  if (!isFunctionReq) {
    logger.silly(` - not a function request`);
  }

  if (!isRequestMethodValid(req, isFunctionReq, isAuthReq)) {
    res.statusCode = 405;
    return res.end();
  }

  logger.silly(`checking for query params`);

  const { urlPathnameWithoutQueryParams, url, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

  logger.silly(`checking rewrite auth login request`);
  if (urlPathnameWithQueryParams && isLoginRequest(urlPathnameWithoutQueryParams)) {
    logger.silly(` - auth login dectected`);

    authStatus = AUTH_STATUS.HostNameAuthLogin;
    req.url = url.toString();
    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  }

  logger.silly(`checking rewrite auth logout request`);
  if (urlPathnameWithQueryParams && isLogoutRequest(urlPathnameWithoutQueryParams)) {
    logger.silly(` - auth logout dectected`);

    authStatus = AUTH_STATUS.HostNameAuthLogout;
    req.url = url.toString();
    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  }

  if (!isRouteRequiringUserRolesCheck(req, matchingRouteRule, isFunctionReq, authStatus)) {
    handleErrorPage(req, res, 401, userConfig?.responseOverrides);
    return serveStaticOrProxyResponse(req, res, proxyApp, target);
  }

  if (authStatus != AUTH_STATUS.NoAuth && (authStatus != AUTH_STATUS.HostNameAuthLogin || !urlPathnameWithQueryParams)) {
    if (authStatus == AUTH_STATUS.HostNameAuthLogin && matchingRouteRule) {
      return getAuthBlockResponse(req, res, userConfig, matchingRouteRule);
    }

    return await handleAuthRequest(req, res, matchingRouteRule, userConfig);
  }

  if (!getResponse(req, res, matchingRouteRule, userConfig, isFunctionReq)) {
    logger.silly(` - url: ${chalk.yellow(req.url)}`);
    logger.silly(` - target: ${chalk.yellow(target)}`);

    serveStaticOrProxyResponse(req, res, proxyApp, target);
  }
}
