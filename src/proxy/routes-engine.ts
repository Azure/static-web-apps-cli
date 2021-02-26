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

export const processUserRoute = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoutes: SWAConfigFileRoute[]) => {
  if (!req) {
    return Promise.resolve(-1);
  }

  const userDefinedRoute = userDefinedRoutes.find((routeDef) => new RegExp(routeDef.route).test(req.url!));
  console.info("INFO: applying user config", userDefinedRoute);

  if (userDefinedRoute) {
    // set headers
    if (userDefinedRoute.headers) {
      for (const header in userDefinedRoute.headers) {
        res.setHeader(header, userDefinedRoute.headers[header]);
      }
    }

    // check allowed method
    if (userDefinedRoute.methods?.includes(req.method as string) === false) {
      res.writeHead(405);
      res.end();
      return;
    }

    // ACL
    if (userDefinedRoute.allowedRoles && req.headers.cookie) {
      const user = decodeCookie(req.headers.cookie);
      if (!userDefinedRoute.allowedRoles.some((role) => user?.userRoles.some((ur: string) => ur === role))) {
        return Promise.resolve(403);
      }
    }

    // specific status code but no attached route
    if (userDefinedRoute.statusCode && !userDefinedRoute.serve) {
      if (userDefinedRoute.statusCode === 404) {
        return Promise.resolve(404);
      } else {
        res.writeHead(userDefinedRoute.statusCode);
        res.end();
        return;
      }
    }

    // rewrite
    if (userDefinedRoute.rewrite) {
      req.url = userDefinedRoute.rewrite;
    }

    // redirect route
    if (userDefinedRoute.serve || userDefinedRoute.redirect) {
      let route = (userDefinedRoute.serve || userDefinedRoute.redirect) as string;
      if (route.startsWith(".auth")) {
        route = `app/${route}`;
      }
      // temporarily redirect
      res.writeHead(302, {
        Location: route,
      });
    }
  }

  return Promise.resolve(-1);
};
