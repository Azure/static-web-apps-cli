import fs from "fs";
import http from "http";
import { decodeCookie, findSWAConfigFile } from "../core/utils";

// The routes engine implemetation is (and should always be) aligned with the documentation
// see: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration

export const handleUserConfig = async (appLocation: string): Promise<SWAConfigFile | null> => {
  if (!fs.existsSync(appLocation)) {
    return null;
  }

  const configFile = await findSWAConfigFile(appLocation);
  if (!configFile) {
    return null;
  }

  let config: SWAConfigFile | null = null;
  try {
    config = require(configFile) as SWAConfigFile;
    console.log("reading user config", configFile);
    return config;
  } catch (error) {}
  return config;
};

export const processCustomRoutes = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoutes: SWAConfigFileRoute[]) => {
  if (!req) {
    return Promise.resolve(undefined);
  }

  const userDefinedRoute = userDefinedRoutes.find((routeDef) => {
    const sanitizedUrl = new URL(req.url!, `http://${req.headers.host}`);
    return new RegExp(`^${routeDef.route}`).test(sanitizedUrl.pathname);
  });

  if (userDefinedRoute) {
    console.info("INFO: applying user config", userDefinedRoute);

    // set headers
    if (userDefinedRoute.headers) {
      for (const header in userDefinedRoute.headers) {
        res.setHeader(header, userDefinedRoute.headers[header]);
      }
    }

    // check allowed method
    if (userDefinedRoute.methods?.includes(req.method as string) === false) {
      res.statusCode = 405;
    }

    // ACL
    if (userDefinedRoute.allowedRoles) {
      const user = req.headers.cookie ? decodeCookie(req.headers.cookie) : null;

      if (userDefinedRoute.allowedRoles.some((role) => user?.userRoles?.some((ur: string) => ur === role)) === false) {
        res.statusCode = 403;
      }
    }

    // specific status code but no attached route
    if (userDefinedRoute.statusCode && !userDefinedRoute.serve) {
      res.statusCode = userDefinedRoute.statusCode;
    }

    // rewrite
    if (userDefinedRoute.rewrite) {
      req.url = userDefinedRoute.rewrite;
    }

    // redirect route
    if (userDefinedRoute.serve || userDefinedRoute.redirect) {
      let route = (userDefinedRoute.serve || userDefinedRoute.redirect) as string;
      if (route.startsWith("/.auth")) {
        route = `/app${route}`;
      }

      // temporarily redirect (adding checks to avoid ERR_TOO_MANY_REDIRECTS)
      if (route !== req.url) {
        res.writeHead(userDefinedRoute.statusCode || 302, {
          Location: route,
        });
      }
    }
    console.info("INFO: applied rule", {
      ...res.getHeaders(),
      statusCode: res.statusCode,
    });
  }

  return Promise.resolve(undefined);
};

export const processGlobalHeaders = async (_req: http.IncomingMessage, res: http.ServerResponse, globalHeaders: SWAConfigFileGlobalHeaders) => {
  for (const header in globalHeaders) {
    if (globalHeaders[header] === "") {
      res.removeHeader(header);
    } else {
      res.setHeader(header, globalHeaders[header]);
    }
  }
};

export const processMimeTypes = async (req: http.IncomingMessage, res: http.ServerResponse, mimeTypes: SWAConfigFileMimeTypes) => {
  if (req.url?.includes(".")) {
    const fileExtentionFromURL = req.url?.split(".").pop();
    const overrideMimeType = mimeTypes[`.${fileExtentionFromURL}`];

    if (fileExtentionFromURL && overrideMimeType) {
      res.setHeader("Content-Type", overrideMimeType);
    }
  }
};

export const processResponseOverrides = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  responseOverrides: SWAConfigFileResponseOverrides
) => {
  const statusCode = res.statusCode;

  if (statusCode) {
    const overridenStatusCode = responseOverrides[statusCode];

    if (overridenStatusCode) {
      if (overridenStatusCode.statusCode) {
        res.statusCode = overridenStatusCode.statusCode;
      }
      if (overridenStatusCode.redirect) {
        res.setHeader("Location", overridenStatusCode.redirect);
      }
      if (overridenStatusCode.rewrite && req.url !== overridenStatusCode.rewrite) {
        req.url = overridenStatusCode.rewrite;
      }
    }
  }
};
