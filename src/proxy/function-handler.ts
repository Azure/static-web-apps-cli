import type http from "http";
import httpProxy from "http-proxy";
import type net from "net";
import { DEFAULT_CONFIG } from "../config";
import { decodeCookie, logger, logRequest, registerProcessExit, validateCookie } from "../core";
import { SWA_CLI_API_URI, SWA_CLI_APP_PROTOCOL } from "../core/utils/constants";

const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });

function injectHeaders(req: http.IncomingMessage) {
  const host = `${SWA_CLI_APP_PROTOCOL}://${req.headers.host}`;
  req.headers["X-MS-ORIGINAL-URL"] = encodeURI(new URL(req.url!, host).toString());

  // generate a fake correlation ID
  req.headers["X-MS-REQUEST-ID"] = Math.random().toString(36).substring(7);
}

function injectClientPrincipalCookies(req: http.IncomingMessage) {
  const cookie = req.headers.cookie;
  if (cookie && validateCookie(cookie)) {
    const user = decodeCookie(cookie);
    const buff = Buffer.from(JSON.stringify(user), "utf-8");
    const token = buff.toString("base64");
    req.headers["X-MS-CLIENT-PRINCIPAL"] = token;

    // locally, we set the JWT bearer token to be the same as the cookie value because we are not using the real auth flow.
    // Note: on production, SWA uses a valid encrypted JWT token!
    if (!req.headers.authorization) {
      req.headers.authorization = `Bearer ${token}`;
    }
  }
}

function onConnectionLost(req: http.IncomingMessage, res: http.ServerResponse | net.Socket, target: string) {
  return (error: Error) => {
    if (error.message.includes("ECONNREFUSED")) {
      const statusCode = 502;
      (res as http.ServerResponse).statusCode = statusCode;
      const uri = `${target}${req.url}`;
      logger.error(`${req.method} ${uri} - ${statusCode} (Bad Gateway)`);
    } else {
      logger.error(`${error.message}`);
    }
    logger.silly({ error });
    res.end();
  };
}

export function handleFunctionRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const target = SWA_CLI_API_URI();

  logger.silly(`functions request detected. Proxifying to Azure Functions Core Tools emulator...`);
  logger.silly(` - target: ${target}`);

  injectHeaders(req);
  injectClientPrincipalCookies(req);

  proxyApi.web(
    req,
    res,
    {
      target,
    },
    onConnectionLost(req, res, target)
  );
  proxyApi.once("proxyRes", (proxyRes: http.IncomingMessage, req: http.IncomingMessage) => {
    logRequest(req, null, proxyRes.statusCode);
  });

  logRequest(req);

  registerProcessExit(() => {
    proxyApi.close(() => logger.log("Api proxy stopped."));
    process.exit(0);
  });
}

export function isFunctionRequest(req: http.IncomingMessage, rewritePath?: string) {
  let path = rewritePath || req.url;
  return Boolean(path?.startsWith(`/${DEFAULT_CONFIG.apiPrefix}`));
}
