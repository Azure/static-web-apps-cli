import type http from "http";
import { logger } from "../../../core";

import { CACHE_CONTROL_MAX_AGE, HEADER_DELETE_KEYWORD } from "../../../core/constants";

// // See: https://docs.microsoft.com/azure/static-web-apps/configuration#global-headers

export function updateResponseHeaders(res: http.ServerResponse, matchingRouteHeaders: SWAConfigFileRouteHeaders) {
  const headers = getResponseHeaders(matchingRouteHeaders);
  for (const header in headers) {
    if (headers[header].includes(HEADER_DELETE_KEYWORD)) {
      res.removeHeader(header);
    } else {
      res.setHeader(header, headers[header]);
    }
  }
}

export function getResponseHeaders(matchingRouteHeaders: SWAConfigFileRouteHeaders | undefined) {
  const contentResponseHeaders: SWAConfigFileGlobalHeaders = {};

  if (matchingRouteHeaders == null) {
    return contentResponseHeaders;
  }

  for (const header in matchingRouteHeaders) {
    if (matchingRouteHeaders[header] === "") {
      // in order to avoid mutating the response object here, we add a placeholder
      // the caller function will take care of updating the res object
      contentResponseHeaders[header] = `${HEADER_DELETE_KEYWORD} ${contentResponseHeaders[header]}`;
    } else {
      contentResponseHeaders[header] = matchingRouteHeaders[header];
    }
  }

  return contentResponseHeaders;
}

export function getDefaultHeaders(etagStr?: string, cacheControl?: string) {
  const headers: SWAConfigFileGlobalHeaders = {
    //"X-Frame-Options": "SAMEORIGIN" ,
    //"Feature-Policy": "accelerometer 'none'; camera 'self'; geolocation 'none'; gyroscope 'none'; magnetometer 'none'; microphone 'self'; payment 'none'; usb 'none'" ,
    "Strict-Transport-Security": "max-age=10886400; includeSubDomains; preload",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "X-DNS-Prefetch-Control": "off",
  };

  if (cacheControl) {
    headers["Cache-Control"] = cacheControl;
  }

  if (etagStr) {
    headers["ETag"] = etagStr;
  }

  return headers;
}

export function getHeadersForRoute(
  matchingRouteHeaders: SWAConfigFileRouteHeaders | undefined,
  globalHeaders: SWAConfigFileGlobalHeaders | undefined
) {
  logger.silly(`constructing headers`);
  logger.silly({ matchingRouteHeaders });
  logger.silly({ globalHeaders });

  const cacheControlHeader = `must-revalidate, max-age=${CACHE_CONTROL_MAX_AGE}`;

  // Etag header - must be surrounded by ""
  // TODO should we support ETag locally?
  const etagStr = '"SWA-CLI-ETAG"';

  const headers = getDefaultHeaders(etagStr, cacheControlHeader);
  if (globalHeaders) {
    logger.silly(`checking global headers`);
    logger.silly(headers);

    for (const defaultHeaderPair in globalHeaders) {
      headers[defaultHeaderPair] = globalHeaders[defaultHeaderPair];
    }
  }

  if (matchingRouteHeaders) {
    logger.silly(`checking headers for route`);
    logger.silly(matchingRouteHeaders);

    for (const headerPair in matchingRouteHeaders) {
      headers[headerPair] = matchingRouteHeaders[headerPair];
    }
  }

  return headers;
}
