import chalk from "chalk";
import type http from "http";
import { isHttpUrl, isSWAConfigFileUrl, logger } from "../../core";
import { IS_APP_DEV_SERVER } from "../../core/constants";
import { handleErrorPage } from "../handlers/error-page.handler";
import { handleFunctionRequest, isFunctionRequest } from "../handlers/function.handler";
import {
  applyRedirectResponse,
  getHeadersForRoute,
  getMimeTypeForExtension,
  isRequestPathExcludedFromNavigationFallback,
  tryFindFileForRequest,
  updateResponseHeaders,
} from "../routes-engine";
import { parseQueryParams } from "../routes-engine/route-processor";

export function getResponse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  matchedRoute: SWAConfigFileRoute | undefined,
  userConfig: SWAConfigFile | undefined,
  isFunctionRequest: boolean
): boolean {
  const statusCodeToServe = parseInt(`${matchedRoute?.statusCode}`, 10);
  const redirect = matchedRoute?.redirect;
  const rewrite = matchedRoute?.rewrite;
  logger.silly(`using userConfig`);
  logger.silly({ userConfig });

  if (redirect) {
    logger.silly(` - redirect rule detected. Exit`);

    applyRedirectResponse(req, res, matchedRoute);
    return false;
  }
  // We should always set the x-ms-original-url to be the full request URL.
  req.headers["x-ms-original-url"] = new URL(req.url!, `http://${req.headers.host}`).href;
  if (rewrite) {
    req.url = rewrite;
  }

  if ([403, 401].includes(statusCodeToServe)) {
    logger.silly(` - ${statusCodeToServe} code detected. Exit`);

    handleErrorPage(req, res, statusCodeToServe, userConfig?.responseOverrides);
    return false;
  }

  if (isFunctionRequest) {
    handleFunctionRequest(req, res);
    return true;
  }

  const storageResult = getStorageContent(
    req,
    res,
    rewrite,
    matchedRoute,
    userConfig?.responseOverrides,
    userConfig?.navigationFallback,
    userConfig?.mimeTypes,
    matchedRoute?.headers,
    userConfig?.globalHeaders
  );

  if (storageResult.isFunctionFallbackRequest) {
    req.url = userConfig?.navigationFallback.rewrite!;
    handleFunctionRequest(req, res);
    return true;
  }
  if (statusCodeToServe) {
    res.statusCode = statusCodeToServe;
  }
  return false;
}

export function getStorageContent(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathToServe: string | undefined,
  matchedRoute: SWAConfigFileRoute | undefined,
  responseOverridesRule: SWAConfigFileResponseOverrides | undefined,
  navigationFallbackRule: SWAConfigFileNavigationFallback | undefined,
  mimeTypeRule: SWAConfigFileMimeTypes | undefined,
  routeHeaders: SWAConfigFileRouteHeaders | undefined,
  globalHeaders: SWAConfigFileGlobalHeaders | undefined
): {
  isFunctionFallbackRequest: boolean;
  isSuccessfulSiteHit: boolean;
} {
  logger.silly(`checking storage content`);

  // don't serve staticwebapp.config.json / routes.json
  if (isSWAConfigFileUrl(req)) {
    logger.silly(` - request to config file detected. Exit`);

    handleErrorPage(req, res, 404, responseOverridesRule);
    return {
      isFunctionFallbackRequest: false,
      isSuccessfulSiteHit: false,
    };
  }

  let requestPath = req.url as string;
  let filePathFromRequest: string | null = null;
  let decodedRequestPath = req.url;
  const { urlPathnameWithoutQueryParams } = parseQueryParams(req, matchedRoute);

  // we only process if the user is NOT connecting to a remote dev server.
  // if the user is connecting to a remote dev server, we skip the following logic.
  if (IS_APP_DEV_SERVER()) {
    logger.silly(`remote dev server detected.`);
    return {
      isFunctionFallbackRequest: false,
      isSuccessfulSiteHit: true,
    };
  } else {
    requestPath = urlPathnameWithoutQueryParams;
    decodedRequestPath = urlPathnameWithoutQueryParams;

    if (pathToServe) {
      requestPath = pathToServe;
      decodedRequestPath = decodeURI(pathToServe);
    }

    filePathFromRequest = tryFindFileForRequest(requestPath!);
  }

  if (!filePathFromRequest) {
    let shouldDisplayNotFoundPage = true;
    if (navigationFallbackRule?.rewrite) {
      const isFunctionFallback = isFunctionRequest(req, navigationFallbackRule.rewrite);
      logger.silly(` - isFunctionFallback: ${chalk.yellow(isFunctionFallback)}`);

      if (isFunctionFallback) {
        return {
          isFunctionFallbackRequest: true,
          isSuccessfulSiteHit: false,
        };
      } else {
        const navigationFallbackRewrite = navigationFallbackRule.rewrite;
        logger.silly(`validating navigation fallback rewrite rule`);
        logger.silly(` - rewrite: ${chalk.yellow(navigationFallbackRewrite)}`);

        const isNavigationFallbackWritePathExists = tryFindFileForRequest(navigationFallbackRewrite);
        if (
          isNavigationFallbackWritePathExists &&
          !isRequestPathExcludedFromNavigationFallback(decodedRequestPath, navigationFallbackRule, matchedRoute)
        ) {
          shouldDisplayNotFoundPage = false;
        }

        if (navigationFallbackRewrite) {
          filePathFromRequest = navigationFallbackRewrite;

          if (!shouldDisplayNotFoundPage) {
            logger.silly(`rewrite request to ${chalk.yellow(filePathFromRequest)}`);
            req.url = filePathFromRequest;
          }
        }
      }
    }

    logger.silly(` - shouldDisplayNotFoundPage: ${chalk.yellow(shouldDisplayNotFoundPage)}`);

    if (shouldDisplayNotFoundPage) {
      handleErrorPage(req, res, 404, responseOverridesRule);
      return {
        isFunctionFallbackRequest: false,
        isSuccessfulSiteHit: false,
      };
    }
  }

  if (!filePathFromRequest) {
    return {
      isFunctionFallbackRequest: false,
      isSuccessfulSiteHit: false,
    };
  }

  // if the file path is a remote HTTP request, this means we are connecting to a dev server.
  // exist here and let the remote server handle the request.
  if (isHttpUrl(filePathFromRequest)) {
    return {
      isFunctionFallbackRequest: false,
      isSuccessfulSiteHit: true,
    };
  }

  // mime type
  const mimeType = getMimeTypeForExtension(filePathFromRequest, mimeTypeRule);
  res.setHeader("Content-Type", mimeType);

  // compute both global and route headers
  const matchingRouteHeaders = getHeadersForRoute(routeHeaders, globalHeaders);

  if (responseOverridesRule) {
    // Handle HEAD request
    if (req.method === "HEAD") {
      updateResponseHeaders(res, matchingRouteHeaders);

      res.statusCode = 200;

      return {
        isFunctionFallbackRequest: false,
        isSuccessfulSiteHit: true,
      };
    }

    // Handle OPTIONS request
    if (req.method === "OPTIONS") {
      updateResponseHeaders(res, matchingRouteHeaders);

      const allowStr = "GET, HEAD, OPTIONS";
      res.setHeader("Allow", allowStr);

      res.statusCode = 204; // No Content
      return {
        isFunctionFallbackRequest: false,
        isSuccessfulSiteHit: true,
      };
    }
  }

  // Handle GET request
  updateResponseHeaders(res, matchingRouteHeaders);

  req.url = filePathFromRequest;

  return {
    isSuccessfulSiteHit: true,
    isFunctionFallbackRequest: false,
  };
}
