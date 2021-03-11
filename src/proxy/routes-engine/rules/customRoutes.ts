import http from "http";
import globalyzer from "globalyzer";
import globrex from "globrex";

import { decodeCookie } from "../../../core/utils";

export const matchRoute = (req: http.IncomingMessage, _res: http.ServerResponse) => {
  const sanitizedUrl = new URL(req.url!, `http://${req?.headers?.host}`);

  return (routeDef: SWAConfigFileRoute) => {
    let filter = routeDef.route;
    if (!filter) {
      return false;
    }

    const originlUrl = sanitizedUrl.pathname;

    // we don't support full globs in the config file.
    // add this little workaround to convert a wildcard into a valid glob pattern
    filter = filter.replace("/*", "/**/*");

    // extract glob metadata
    const globSegments = globalyzer(filter);

    // if filter and url segments don't have a commom base path
    // don't process regex, just return false
    if (originlUrl.startsWith(globSegments.base)) {
      const { regex } = globrex(globSegments.glob, { globstar: true, extended: true });

      // extract the last segment (what comes after the base) from the URL:
      // /                    => <empty string>
      // /bar.gif             => bar.gif
      // /images/foo/bar.gif  => bar.gif
      let lastSegmentFromUrl = originlUrl.replace(`${globSegments.base}`, "");

      // globrex generates regex that doesn't match leading forwardslash, so we remove it
      // before processing the regex
      lastSegmentFromUrl = lastSegmentFromUrl.replace(/^\//, "");

      return regex.test(lastSegmentFromUrl!);
    } else {
      return false;
    }
  };
};

export const customRoutes = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoutes: SWAConfigFileRoute[]) => {
  if (!req) {
    return Promise.resolve(undefined);
  }

  const userDefinedRoute = userDefinedRoutes?.find(matchRoute(req, res));

  if (userDefinedRoute) {
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
    const isServeWrite = userDefinedRoute.serve && ![301, 302].includes(userDefinedRoute.statusCode!);
    if (isServeWrite || userDefinedRoute.rewrite) {
      req.url = userDefinedRoute.serve || userDefinedRoute.rewrite;
    }

    // redirect route
    const isServeRedirect = userDefinedRoute.serve && [301, 302].includes(userDefinedRoute.statusCode!);
    if (isServeRedirect || userDefinedRoute.redirect) {
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
