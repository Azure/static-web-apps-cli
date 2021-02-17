import fs from "fs";
import http from "http";
import { DEFAULT_CONFIG } from "../config";
import { decodeCookie, findFile } from "../core/utils";

export const handleUserCustomRoutes = async (folder: string): Promise<UserDefinedRoute[]> => {
  if (!fs.existsSync(folder)) {
    return [];
  }

  const routesFile = await findFile(folder, DEFAULT_CONFIG.swaConfigFilePattern!);
  if (!routesFile) {
    return [];
  }

  let routes = [];
  try {
    routes = require(routesFile).routes || [];
  } catch (error) {}

  if (routes.length > 0) {
    console.log("reading routes definition", routesFile);
    return routes;
  }
  return routes;
};

export const processUserRoute = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoutes: UserDefinedRoute[]) => {
  if (!req) {
    return Promise.resolve(-1);
  }

  const userDefinedRoute = userDefinedRoutes.find((routeDef) => new RegExp(routeDef.route).test(req.url!));
  console.log({ userDefinedRoute });

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
      console.log({ user });
      if (!userDefinedRoute.allowedRoles.some((role) => user?.userRoles.some((ur: string) => ur === role))) {
        return Promise.resolve(401);
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
