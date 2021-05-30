import type http from "http";
import chalk from "chalk";
import { DEFAULT_CONFIG } from "../../config";
import { logger } from "../../core";
import { AUTH_STATUS } from "../../core/constants";
import { globToRegExp } from "../../core/utils/glob";
import { getIndexHtml } from "./rules/routes";

export function doesRequestPathMatchRoute(
  requestPath: string,
  routeRule: SWAConfigFileRoute | undefined,
  requestMethod: string | undefined | null,
  methods: string[] | undefined | null,
  authStatus: number
) {
  logger.silly(`check if request match route...`);

  const route = routeRule?.route;
  const hasRouteRuleHasWildcard = route?.includes("*");
  logger.silly(` - route: ${chalk.yellow(route)}`);
  logger.silly(` - wildcard: ${chalk.yellow(hasRouteRuleHasWildcard)}`);

  // Do not match auth requests besides /.auth/login/<idp>
  // /.auth/login/<idp> must match a non wildcard rule
  // no allowed role can be listed for a rule with route /.auth/login/<idp>
  if (
    (authStatus != AUTH_STATUS.NoAuth && authStatus != AUTH_STATUS.HostNameAuthLogin) ||
    (authStatus == AUTH_STATUS.HostNameAuthLogin && (hasRouteRuleHasWildcard || routeRule?.allowedRoles?.length))
  ) {
    logger.silly(` - authStatus: ${chalk.yellow(authStatus)}`);
    logger.silly(` - allowedRoles: ${chalk.yellow(routeRule?.allowedRoles)}`);
    logger.silly(` - match: ${chalk.yellow(false)}`);
    return false;
  }

  // request method must match allowed methods if listed
  if (methods != null && !methods.includes(requestMethod!)) {
    logger.silly(` - methods: ${chalk.yellow(methods)}`);
    logger.silly(` - requestMethod: ${chalk.yellow(requestMethod)}`);
    logger.silly(` - match: ${chalk.yellow(false)}`);
    return false;
  }

  if (route === requestPath || (hasRouteRuleHasWildcard && doesRequestPathMatchWildcardRoute(requestPath, route))) {
    logger.silly(` - doesRequestPathMatchWildcardRoute: ${chalk.yellow(true)}`);
    return true;
  }

  // Since this is a file request, return now, since tring to get a match by appending /index.html doesn't apply here
  if (!route) {
    logger.silly(` - route: ${chalk.yellow(route || "<empty>")}`);
    logger.silly(` - match: ${chalk.yellow(false)}`);

    return false;
  }

  // If the request hasn't already matched the route, and the request is a non-file path,
  // try adding /index.html to the path to see if it then matches. This is especially handy
  // to match a request to the /{customPath}/* route
  const alternateRequestPath = getIndexHtml(requestPath);
  logger.silly(` - alternateRequestPath: ${chalk.yellow(alternateRequestPath)}`);

  return (
    routeRule?.route === alternateRequestPath ||
    (hasRouteRuleHasWildcard && doesRequestPathMatchWildcardRoute(alternateRequestPath, routeRule?.route))
  );
}

export function doesRequestPathMatchLegacyRoute(
  requestPath: string,
  routeRule: SWAConfigFileRoute | undefined,
  isAuthRequest: boolean,
  isFileRequest: boolean
) {
  const hasWildcard = routeRule?.route.includes("*");

  if (routeRule?.route === requestPath || (!isAuthRequest && hasWildcard)) {
    return true;
  }

  // since this is a file request, don't perform the wildcard matching check
  if (isFileRequest) {
    return false;
  }

  // if the request hasn't already matched the route, and the request is a non-file path,
  // try adding /index.html to the path to see if it then matches. This is especially handy
  // to match a request to the /{customPath}/* route
  const alternateRequestPath = getIndexHtml(requestPath);
  return routeRule?.route === alternateRequestPath || (!isAuthRequest && hasWildcard);
}

function doesRequestPathMatchWildcardRoute(requestPath: string, requestPathFileWithWildcard: string | undefined) {
  logger.silly(`checking wildcard route...`);
  logger.silly(` - glob: ${chalk.yellow(requestPathFileWithWildcard)}`);

  const pathBeforeWildcard = requestPathFileWithWildcard?.substr(0, requestPathFileWithWildcard?.indexOf("*"));
  logger.silly(` - pathBeforeWildcard: ${chalk.yellow(pathBeforeWildcard || "<empty>")}`);

  // before processing regexp which might be expensive
  // let's check first if both path and rule start with the same substring
  if (pathBeforeWildcard && requestPath.startsWith(pathBeforeWildcard) === false) {
    logger.silly(` - substring don't match. Exit.`);

    return false;
  }

  // we don't support full globs in the config file.
  // add this little utility to convert a wildcard into a valid glob pattern
  const regexp = new RegExp(`^${globToRegExp(requestPathFileWithWildcard)}$`);
  logger.silly(` - regexp: ${chalk.yellow(regexp)}`);

  const isMatch = regexp.test(requestPath);
  logger.silly(` - isMatch: ${chalk.yellow(isMatch)}`);

  return isMatch;
}

export function isCustomUrl(req: http.IncomingMessage) {
  return !!req.url?.startsWith(DEFAULT_CONFIG.customUrlScheme!);
}
