import fs from "fs";
import http from "http";
import { DEFAULT_CONFIG } from "../config";
import { decodeCookie, findFile } from "../core/utils";

export const handleUserConfig = async (folder: string): Promise<UserConfig> => {
  if (!fs.existsSync(folder)) {
    return { userDefinedRoutes: [] };
  }

  const configFile = await findFile(folder, DEFAULT_CONFIG.swaConfigFilePattern!);
  if (!configFile) {
    console.log("Config file not found");
    return { userDefinedRoutes: [] };
  }

  let config: UserConfig = { userDefinedRoutes: [] };

  try {
    config.userDefinedRoutes = require(configFile).routes || [];
  } catch (error) {
    console.log(error);
  }

  try {
    config["userDefinedResponseOverrides"] = require(configFile).responseOverrides || [];
  } catch (error) {
    console.log("No responseOverrides found, skipping");
  }

  try {
    config["navigationFallback"] = require(configFile).navigationFallback || [];
  } catch (error) {
    console.log("No navigationFallback found, skipping");
  }

  try {
    config["globalHeaders"] = require(configFile).globalHeaders || [];
  } catch (error) {
    console.log("No globalHeaders found, skipping");
  }

  try {
    config["mimeTypes"] = require(configFile).mimeTypes || [];
  } catch (error) {
    console.log("No mimeTypes found, skipping");
  }

  if (config.userDefinedRoutes.length > 0) {
    console.log("Reading routes definition", configFile);
  }

  return config;
};

export const processUserRoute = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoutes: UserDefinedRoute[]) => {
  if (!req) {
    return Promise.resolve(-1);
  }

  const userDefinedRoute = userDefinedRoutes.find((routeDef) => new RegExp(`^${routeDef.route}`).test(req.url!));

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
    if (userDefinedRoute.allowedRoles && !userDefinedRoute.allowedRoles.includes("anonymous")) {
      if (req.headers.cookie) {
        const user = decodeCookie(req.headers.cookie);
        console.log({ user });
        if (!userDefinedRoute.allowedRoles.some((role) => user?.userRoles.some((ur: string) => ur === role))) {
          return Promise.resolve(401);
        }
      } else {
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
      const route = (userDefinedRoute.serve || userDefinedRoute.redirect) as string;
      const statusCode = userDefinedRoute.statusCode || 302;
      res.writeHead(statusCode, { Location: route });
    }
  }

  return Promise.resolve(-1);
};
