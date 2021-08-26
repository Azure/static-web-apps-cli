import chalk from "chalk";
import type http from "http";
import { isHttpUrl, isSWAConfigFileUrl, logger } from "../../core";
import { handleErrorPage } from "../handlers/error-page.handler";
import { handleFunctionRequest, isFunctionRequest } from "../handlers/function.handler";
import {
  applyRedirectResponse,
  getHeadersForRoute,
  getMimeTypeForExtension,
  isRequestPathExcludedFromNavigationFallback,
  tryFindFileForRequest,
  updateReponseHeaders,
} from "../routes-engine";
import { parseQueryParams } from "../routes-engine/route-processor";

export let isFunctionFallback = false;

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

  logger.silly(`using userConfig`);
  logger.silly({ userConfig });

  if (redirect) {
    logger.silly(` - redirect rule detected. Exit`);

    return applyRedirectResponse(req, res, matchedRoute);
  }

  if (rewrite) {
    req.url = rewrite;
  }

  if ([403, 401].includes(statusCodeToServe)) {
    logger.silly(` - ${statusCodeToServe} code detected. Exit`);

    return handleErrorPage(req, res, statusCodeToServe, userConfig?.responseOverrides);
  }

  if (isFunctionRequest) {
    return handleFunctionRequest(req, res);
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
    isFunctionFallback = true;
    if (userConfig?.navigationFallback.rewrite) {
      req.url = userConfig.navigationFallback.rewrite;
    }
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

  const { matchingRewriteRoutePath } = parseQueryParams(req, matchedRoute);

  let requestPath = matchingRewriteRoutePath;
  let decodedRequestPath = matchingRewriteRoutePath;

  if (pathToServe) {
    requestPath = pathToServe;
    decodedRequestPath = decodeURI(pathToServe);
  }

  let filePathFromRequest = tryFindFileForRequest(requestPath!);
  logger.silly(` - filePathFromRequest: ${chalk.yellow(filePathFromRequest)}`);

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
      updateReponseHeaders(res, matchingRouteHeaders);

      res.statusCode = 200;

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
