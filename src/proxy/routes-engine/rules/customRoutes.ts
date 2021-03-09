import http from "http";
import { decodeCookie } from "../../../core/utils";

export const customRoutes = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoutes: SWAConfigFileRoute[]) => {
  if (!req) {
    return Promise.resolve(undefined);
  }

  const userDefinedRoute = userDefinedRoutes?.find((routeDef) => {
    const sanitizedUrl = new URL(req.url!, `http://${req.headers.host}`);
    let route = routeDef.route;

    // convert wildchars in route into a valid regex * quantifier
    if (route === "/*") {
      route = "/.*";
    } else {
      route = route.replace(/\*/g, ".*");
    }

    return new RegExp(`^${route}$`).test(sanitizedUrl.pathname);
  });

  if (userDefinedRoute) {
    console.log(">>>> applying rule", userDefinedRoute);

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
      } else {
        res.statusCode = 200;
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

      // redirects
      // note: adding checks to avoid ERR_TOO_MANY_REDIRECTS
      if (route !== req.url) {
        res.writeHead(userDefinedRoute.statusCode || 302, {
          Location: route,
        });
        res.end();
      }
    }
  }

  return Promise.resolve(undefined);
};
