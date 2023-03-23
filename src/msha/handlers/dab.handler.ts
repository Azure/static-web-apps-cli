import chalk from "chalk";
import type http from "http";
import httpProxy from "http-proxy";
import { decodeCookie, logger, logRequest, registerProcessExit, validateCookie } from "../../core";
import { SWA_CLI_DATA_API_URI } from "../../core/constants";
import { onConnectionLost } from "../middlewares/request.middleware";

const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
registerProcessExit(() => {
  logger.silly(`killing SWA CLI`);
  proxyApi.close(() => logger.log("Data-Api proxy stopped."));
  process.exit(0);
});

/**
 * Gets response from the Data Api
 * @param req http request url
 * @param res http response after redirecting to Data api builder
 */
export function handleDataApiRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const target = SWA_CLI_DATA_API_URI();

  proxyApi.web(
    req,
    res,
    {
      target,
    },
    onConnectionLost(req, res, target, "↳")
  );

  proxyApi.once("proxyReq", (proxyReq: http.ClientRequest) => {
    injectHeaders(proxyReq, target);
    injectClientPrincipalCookies(proxyReq);
  });

  proxyApi.once("proxyRes", (proxyRes: http.IncomingMessage) => {
    logger.silly(`getting response from remote host`);
    logRequest(req, "", proxyRes.statusCode);
  });

  logRequest(req, target);
}

export function injectHeaders(req: http.ClientRequest, host: string | undefined) {
  const X_MS_ORIGINAL_URL_HEADER = "x-ms-original-url";
  const X_MS_REQUEST_ID_HEADER = "x-ms-request-id";

  logger.silly(`injecting headers to Data-api request:`);
  if (!req.getHeader(X_MS_ORIGINAL_URL_HEADER)) {
    req.setHeader(X_MS_ORIGINAL_URL_HEADER, encodeURI(new URL(req.path!, host).toString()));
    logger.silly(` - x-ms-original-url: ${chalk.yellow(req.getHeader(X_MS_ORIGINAL_URL_HEADER))}`);
  }
  // generate a fake correlation ID
  req.setHeader(X_MS_REQUEST_ID_HEADER, `SWA-CLI-${Math.random().toString(36).substring(2).toUpperCase()}`);
  logger.silly(` - x-ms-request-id: ${chalk.yellow(req.getHeader(X_MS_REQUEST_ID_HEADER))}`);
}

/**
 * Checks if the request is Data-api request or not
 * @param req http request url
 * @param rewritePath
 * @returns true if the request is data-api Request else false
 */
export function isDataApiRequest(req: http.IncomingMessage, rewritePath?: string): boolean {
  const path = rewritePath || req.url;
  return Boolean(path?.toLowerCase().startsWith(`/data-api/`));
}

export function injectClientPrincipalCookies(req: http.ClientRequest) {
  const X_MS_CLIENT_PRINCIPAL_HEADER = "X-MS-CLIENT-PRINCIPAL";
  const AUTH_HEADER = "authorization";
  const COOKIE_HEADER = "cookie";
  const CLAIMS_HEADER = "claims";

  logger.silly(`injecting client principal to Functions request:`);

  const cookie = req.getHeader(COOKIE_HEADER) as string;
  if (cookie && validateCookie(cookie)) {
    const user = decodeCookie(cookie);

    // Remove claims from client principal to match SWA behaviour. See https://github.com/MicrosoftDocs/azure-docs/issues/86803.
    // The following property deletion can be removed depending on outcome of the above issue.
    if (user) {
      delete user[CLAIMS_HEADER];
    }

    const buff = Buffer.from(JSON.stringify(user), "utf-8");
    const token = buff.toString("base64");
    req.setHeader(X_MS_CLIENT_PRINCIPAL_HEADER, token);
    logger.silly(` - X-MS-CLIENT-PRINCIPAL: ${chalk.yellow(req.getHeader(X_MS_CLIENT_PRINCIPAL_HEADER))}`);

    // locally, we set the JWT bearer token to be the same as the cookie value because we are not using the real auth flow.
    // Note: on production, SWA uses a valid encrypted JWT token!
    if (!req.getHeader(AUTH_HEADER)) {
      req.setHeader(AUTH_HEADER, `Bearer ${token}`);
      logger.silly(` - Authorization: ${chalk.yellow(req.getHeader(AUTH_HEADER))}`);
    }
  } else {
    logger.silly(` - no valid cookie found`);
  }
}
