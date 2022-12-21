import chalk from "chalk";
import type http from "http";
import { SWA_CLI_DATA_API_URI } from "../../core/constants";
import httpProxy from "http-proxy";
import { logger, logRequest, registerProcessExit } from "../../core";
import { onConnectionLost } from "../middlewares/request.middleware";

const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
registerProcessExit(() => {
  logger.silly(`killing SWA CLI`);
  proxyApi.close(() => logger.log("Api proxy stopped."));
  process.exit(0);
});

/**
 * Gets response from the Data Api
 * @param req http request url
 * @param res http response after redirecting to Data api builder
 */
export function handleDataApiRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const target = SWA_CLI_DATA_API_URI();

  console.log(target);

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
  });

  proxyApi.once("proxyRes", (proxyRes: http.IncomingMessage) => {
    logger.silly(`getting response from remote host`);
    logRequest(req, "", proxyRes.statusCode);
  });

  logRequest(req, target);
}

function injectHeaders(req: http.ClientRequest, host: string | undefined) {
  logger.silly(`injecting headers to Data-api request:`);
  if (!req.getHeader("x-ms-original-url")) {
    req.setHeader("x-ms-original-url", encodeURI(new URL(req.path!, host).toString()));
    logger.silly(` - x-ms-original-url: ${chalk.yellow(req.getHeader("x-ms-original-url"))}`);
  }
  // generate a fake correlation ID
  req.setHeader("x-ms-request-id", `SWA-CLI-${Math.random().toString(36).substring(2).toUpperCase()}`);
  logger.silly(` - x-ms-request-id: ${chalk.yellow(req.getHeader("x-ms-request-id"))}`);
}

/**
 * Checks if the request is Data-api request or not
 * @param req http request url
 * @param rewritePath
 * @returns true if the request is data-api Request else false
 */
export function isDataApiRequest(req: http.IncomingMessage, rewritePath?: string): boolean {
  const path = rewritePath || req.url;
  return Boolean(path?.toLowerCase().startsWith(`/data-api`));
}
