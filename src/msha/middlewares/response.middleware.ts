import chalk from "chalk";
import type http from "http";
import { isSWAConfigFileUrl, logger } from "../../core";
import { pageNotFoundResponse } from "../handlers/error-page.handler";
import { handleFunctionRequest, isFunctionRequest } from "../handlers/function.handler";
import {
  applyRedirectResponse,
  getHeadersForRoute,
  getMimeTypeForExtension,
  isRequestPathExcludedFromNavigationFallback,
  tryFindFileForRequest,
  updateReponseHeaders,
} from "../routes-engine";

export function getResponse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  matchedRoute: SWAConfigFileRoute | undefined,
  userConfig: SWAConfigFile | undefined,
  isFunctionRequest: boolean
) {
  const statusCodeToServe = parseInt(`${matchedRoute?.statusCode}`, 10);
  const redirect = matchedRoute?.redirect;
  const rewrite = matchedRoute?.rewrite;

  if (redirect) {
    return applyRedirectResponse(req, res, matchedRoute);
  }

  if (rewrite) {
    req.url = rewrite;
  }

  if (isFunctionRequest) {
    return handleFunctionRequest(req, res);
  }

  logger.silly(`using userConfig...`);
  logger.silly({ userConfig });

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
    return handleFunctionRequest(req, res);
  }

  if (statusCodeToServe) {
    res.statusCode = statusCodeToServe;
  }
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
  logger.silly(`checking storage content...`);

  let requestPath = req.url;
  let decodedRequestPath = req.url;

  if (pathToServe) {
    requestPath = pathToServe;
    decodedRequestPath = decodeURI(pathToServe);
  }

  let filePathFromRequest = tryFindFileForRequest(requestPath!);

  // don't serve staticwebapp.config.json / routes.json
  if (isSWAConfigFileUrl(req)) {
    logger.silly(` - request to config file detected.`);

    pageNotFoundResponse(req, res, responseOverridesRule);
    return {
      isFunctionFallbackRequest: false,
      isSuccessfulSiteHit: false,
    };
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
        logger.silly(`validating navigation fallback rewrite rule...`);
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
      pageNotFoundResponse(req, res, responseOverridesRule);
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

  // mime type
  const mimeType = getMimeTypeForExtension(filePathFromRequest, mimeTypeRule);

  // compute both global and route headers
  const matchingRouteHeaders = getHeadersForRoute(routeHeaders, globalHeaders);

  if (responseOverridesRule) {
    // Handle HEAD request
    if (req.method === "HEAD") {
      updateReponseHeaders(res, matchingRouteHeaders);

      res.statusCode = 200;
      res.setHeader("Content-Type", mimeType);

      return {
        isFunctionFallbackRequest: false,
        isSuccessfulSiteHit: true,
      };
    }

    // Handle OPTIONS request
    if (req.method === "OPTIONS") {
      updateReponseHeaders(res, matchingRouteHeaders);

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
  updateReponseHeaders(res, matchingRouteHeaders);

  req.url = filePathFromRequest;

  return {
    isSuccessfulSiteHit: true,
    isFunctionFallbackRequest: false,
  };
}
