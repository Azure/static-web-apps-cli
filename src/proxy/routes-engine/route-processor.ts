import chalk from "chalk";
import { logger } from "../../core";
import { globToRegExp } from "../../core/utils/glob";
import { AUTH_STATUS } from "../../core/utils/constants";

export function doesRequestPathMatchRoute(
  requestPath: string,
  routeRule: SWAConfigFileRoute | undefined,
  requestMethod: string | undefined | null,
  methods: string[] | undefined | null,
  authStatus: number
) {
  logger.silly(`check if request match route...`);

  const hasRouteRuleHasWildcard = routeRule?.route.includes("*");
  logger.silly(` - route: ${chalk.yellow(routeRule?.route)}`);
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

  if (routeRule?.route === requestPath || (hasRouteRuleHasWildcard && doesRequestPathMatchWildcardRoute(requestPath, routeRule?.route))) {
    logger.silly(` - doesRequestPathMatchWildcardRoute: ${chalk.yellow(true)}`);
    return true;
  }

  // Since this is a file request, return now, since tring to get a match by appending /index.html doesn't apply here
  if (!routeRule?.route) {
    logger.silly(` - route: ${chalk.yellow(routeRule?.route || "<EMPTY>")}`);
    logger.silly(` - match: ${chalk.yellow(false)}`);

    return false;
  }

  // If the request hasn't already matched the route, and the request is a non-file path,
  // try adding /index.html to the path to see if it then matches. This is especially handy
  // to match a request to the /{customPath}/* route
  const alternateRequestPath = `${requestPath}/index.html`;
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
  const alternateRequestPath = `${requestPath}/index.html`;
  return routeRule?.route === alternateRequestPath || (!isAuthRequest && hasWildcard);
}

function doesRequestPathMatchWildcardRoute(requestPath: string, requestPathFileExtension: string | undefined) {
  logger.silly(`checking wildcard route (regexp)...`);
  // we don't support full globs in the config file.
  // add this little utility to convert a wildcard into a valid glob pattern
  const regexp = new RegExp(`^${globToRegExp(requestPathFileExtension)}$`);
  logger.silly(` - regexp: ${chalk.yellow(regexp)}`);

  const isMatch = regexp.test(requestPath);
  logger.silly(` - isMatch: ${chalk.yellow(isMatch)}`);

  return isMatch;
}
