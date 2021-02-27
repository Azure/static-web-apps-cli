import fs from "fs";
import http from "http";
import { decodeCookie, findSWAConfigFile } from "../core/utils";

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

export const processUserConfig = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoutes: SWAConfigFileRoute[]) => {
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
    if (userDefinedRoute.allowedRoles && req.headers.cookie) {
      const user = decodeCookie(req.headers.cookie);

      if (!userDefinedRoute.allowedRoles.some((role) => user?.userRoles?.some((ur: string) => ur === role))) {
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
