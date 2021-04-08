import globalyzer from "globalyzer";
import globrex from "globrex";
import http from "http";
import { decodeCookie } from "../../../core";

export const matchRoute = (req: http.IncomingMessage, isLegacyConfigFile: boolean) => {
  const sanitizedUrl = new URL(req.url!, `http://${req?.headers?.host}`);

  return (routeDef: SWAConfigFileRoute) => {
    let filter = routeDef.route;
    if (!filter) {
      return false;
    }

    const originlUrl = sanitizedUrl.pathname;

    // In the legacy config file,
    // the /* rule should only match routes segments (eg. /about), but not file paths (eg. image.png)
    // bypass rules for /api and /.auth routes
    if (isLegacyConfigFile && filter === "/*") {
      if (originlUrl.startsWith("/api") || originlUrl.startsWith("/.auth")) {
        return false;
      } else if (originlUrl.includes(".") && !originlUrl.startsWith("/.auth")) {
        return false;
      } else if (originlUrl.includes("sockjs")) {
        return false;
      }
    }

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

export const customRoutes = async (req: http.IncomingMessage, res: http.ServerResponse, userDefinedRoute: SWAConfigFileRoute | undefined) => {
  if (!req) {
    return Promise.resolve(undefined);
  }

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

      if (userDefinedRoute.allowedRoles.some((role) => user?.userRoles?.some((userRole: string) => userRole === role)) === false) {
        res.statusCode = 403;
      } else {
        res.statusCode = 200;
      }
    }

    // specific status code but no attached route
    if (userDefinedRoute.statusCode && !userDefinedRoute.serve) {
      const code = Number(userDefinedRoute.statusCode);
      if (isNaN(code) === false) {
        res.statusCode = code;
      }
    }

    // rewrite
    const isServeWrite = userDefinedRoute.serve && ![301, 302].includes(Number(userDefinedRoute.statusCode));
    if (isServeWrite || userDefinedRoute.rewrite) {
      req.url = userDefinedRoute.serve || userDefinedRoute.rewrite;
    }

    // redirect route
    const isServeRedirect = userDefinedRoute.serve && [301, 302].includes(Number(userDefinedRoute.statusCode));
    if (isServeRedirect || userDefinedRoute.redirect) {
      let route = (userDefinedRoute.serve || userDefinedRoute.redirect) as string;

      // redirects
      // note: adding checks to avoid ERR_TOO_MANY_REDIRECTS
      if (route !== req.url) {
        res.writeHead(Number(userDefinedRoute.statusCode) || 302, {
          Location: route,
        });
        res.end();
      }
    }
  }

  return Promise.resolve(undefined);
};
