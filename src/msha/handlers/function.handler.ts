import chalk from "chalk";
import type http from "node:http";
import httpProxy from "http-proxy";
import { fetchWithProxy as fetch } from "../../core/utils/fetch-proxy.js";

import { decodeCookie, validateCookie } from "../../core/utils/cookie.js";
import { registerProcessExit } from "../../core/utils/cli.js";
import { logger, logRequest } from "../../core/utils/logger.js";
import { parseUrl } from "../../core/utils/net.js";
import { HAS_API, SWA_CLI_API_URI } from "../../core/constants.js";
import { onConnectionLost } from "../middlewares/request.middleware.js";

const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
registerProcessExit(() => {
  logger.silly(`killing SWA CLI`);
  proxyApi.close(() => logger.log("Api proxy stopped."));
  process.exit(0);
});

function injectHeaders(req: http.ClientRequest, host: string | undefined) {
  logger.silly(`injecting headers to Functions request:`);
  if (!req.getHeader("x-ms-original-url")) {
    req.setHeader("x-ms-original-url", encodeURI(new URL(req.path!, host).toString()));
    logger.silly(` - x-ms-original-url: ${chalk.yellow(req.getHeader("x-ms-original-url"))}`);
  }
  // generate a fake correlation ID
  req.setHeader("x-ms-request-id", `SWA-CLI-${Math.random().toString(36).substring(2).toUpperCase()}`);
  logger.silly(` - x-ms-request-id: ${chalk.yellow(req.getHeader("x-ms-request-id"))}`);
}

function injectClientPrincipalCookies(req: http.ClientRequest) {
  logger.silly(`injecting client principal to Functions request:`);

  const cookie = req.getHeader("cookie") as string;
  if (cookie && validateCookie(cookie)) {
    const user = decodeCookie(cookie);

    // Remove claims from client principal to match SWA behaviour. See https://github.com/MicrosoftDocs/azure-docs/issues/86803.
    // The following property deletion can be removed depending on outcome of the above issue.
    if (user) {
      delete user["claims"];
    }

    const buff = Buffer.from(JSON.stringify(user), "utf-8");
    const token = buff.toString("base64");
    req.setHeader("X-MS-CLIENT-PRINCIPAL", token);
    logger.silly(` - X-MS-CLIENT-PRINCIPAL: ${chalk.yellow(req.getHeader("X-MS-CLIENT-PRINCIPAL"))}`);

    // locally, we set the JWT bearer token to be the same as the cookie value because we are not using the real auth flow.
    // Note: on production, SWA uses a valid encrypted JWT token!
    if (!req.getHeader("authorization")) {
      req.setHeader("authorization", `Bearer ${token}`);
      logger.silly(` - Authorization: ${chalk.yellow(req.getHeader("authorization"))}`);
    }
  } else {
    logger.silly(` - no valid cookie found`);
  }
}

async function resolveLocalhostByFetching(url: string) {
  const { protocol, port } = parseUrl(url);
  const fetchOneOfUrl = [`${protocol}//127.0.0.1:${port}`, `${protocol}//[::1]:${port}`];

  let promises = fetchOneOfUrl.map((Url) => {
    return fetch(Url)
      .then((response) => {
        if (response.ok || response.redirected) {
          logger.silly(`Fetch ${Url} successfully`);
        } else {
          logger.warn(`Fetch ${Url} with status ${response.status} ${response.statusText}`);
        }
        return Url;
      })
      .catch((err) => {
        logger.silly(`Could not fetch ${Url}`);
        throw err;
      });
  });

  try {
    const availableUrl = await Promise.any(promises);
    return availableUrl;
  } catch {
    throw new Error('Error: "localhost" can not be resolved to either IPv4 or IPv6. Please check your network settings.');
  }
}

export function handleFunctionRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  let cliApiUri = SWA_CLI_API_URI();
  const { protocol, hostname, port } = parseUrl(cliApiUri);
  const target = hostname === "localhost" ? `${protocol}//127.0.0.1:${port}` : cliApiUri;

  if (HAS_API) {
    logger.silly(`function request detected. Proxying to Azure Functions emulator`);
    logger.silly(` - target: ${chalk.yellow(target)}`);
  } else {
    logger.log(`***************************************************************************`);
    logger.log(`** Functions request detected but no endpoint configuration was found.   **`);
    logger.log(`** Please use the --api-location option to configure a function endpoint.**`);
    logger.log(`***************************************************************************`);
  }

  proxyApi.web(
    req,
    res,
    {
      target,
    },
    onConnectionLost(req, res, target, "↳"),
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

export function isFunctionRequest(req: http.IncomingMessage, rewritePath?: string) {
  let path = rewritePath || req.url;
  return Boolean(path?.toLowerCase().startsWith(`/api/`));
}

export async function validateFunctionTriggers(url: string) {
  const { hostname } = parseUrl(url);
  if (hostname === "localhost") {
    try {
      url = await resolveLocalhostByFetching(url);
    } catch (error: any) {
      logger.error(error?.message, true);
    }
  }
  try {
    const functionsResponse = await fetch(`${url}/admin/functions`);
    const functions = (await functionsResponse.json()) as Array<{ config: { bindings: string[] } }>;
    const triggers = functions.map((f: any) => f.config.bindings.find((b: any) => /trigger$/i.test(b.type))).map((b: any) => b.type);

    if (triggers.some((t: string) => !/^httptrigger$/i.test(t))) {
      logger.error(
        "\nFunction app contains non-HTTP triggered functions. Azure Static Web Apps managed functions only support HTTP functions. To use this function app with Static Web Apps, see 'Bring your own function app'.\n",
      );
    }
  } catch (error) {
    logger.warn("Unable to query functions trigger types from local function app. Skipping.");
    logger.warn(`Note: Only Http trigger functions are supported. See https://docs.microsoft.com/azure/static-web-apps/apis`);
  }
}
