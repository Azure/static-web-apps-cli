import chalk from "chalk";
import finalhandler from "finalhandler";
import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import https from "https";
import internalIp from "internal-ip";
import net from "net";
import path from "path";
import serveStatic from "serve-static";
import { processAuth } from "../auth";
import { DEFAULT_CONFIG } from "../config";
import { address, decodeCookie, findSWAConfigFile, isHttpUrl, logger, registerProcessExit, validateCookie, validateDevServerConfig } from "../core";
import {
  getMatchingRouteRule,
  navigationFallback,
  isAuthorizedRoute,
  responseOverrides,
  globalHeaders,
  mimeTypes,
  customRoutes,
} from "./routes-engine";

const SWA_WORKFLOW_CONFIG_FILE = process.env.SWA_WORKFLOW_CONFIG_FILE as string;
const SWA_CLI_HOST = process.env.SWA_CLI_HOST as string;
const SWA_CLI_PORT = parseInt((process.env.SWA_CLI_PORT || DEFAULT_CONFIG.port) as string, 10);
const SWA_CLI_API_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_API_PORT);
const SWA_CLI_APP_LOCATION = (process.env.SWA_CLI_APP_LOCATION || DEFAULT_CONFIG.appLocation) as string;
const SWA_CLI_ROUTES_LOCATION = (process.env.SWA_CLI_ROUTES_LOCATION || DEFAULT_CONFIG.swaConfigLocation) as string;
const SWA_CLI_OUTPUT_LOCATION = (process.env.SWA_CLI_OUTPUT_LOCATION || DEFAULT_CONFIG.outputLocation) as string;
const SWA_CLI_API_LOCATION = (process.env.SWA_CLI_API_LOCATION || DEFAULT_CONFIG.apiLocation) as string;
const SWA_CLI_APP_SSL = process.env.SWA_CLI_APP_SSL === "true" || DEFAULT_CONFIG.ssl === true;
const SWA_CLI_APP_SSL_KEY = process.env.SWA_CLI_APP_SSL_KEY as string;
const SWA_CLI_APP_SSL_CERT = process.env.SWA_CLI_APP_SSL_CERT as string;

const PROTOCOL = SWA_CLI_APP_SSL ? `https` : `http`;

const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const isStaticDevServer = isHttpUrl(SWA_CLI_OUTPUT_LOCATION);
const isApiDevServer = isHttpUrl(SWA_CLI_API_LOCATION);

if (!isHttpUrl(SWA_CLI_API_URI)) {
  logger.error(`The provided API URI ${SWA_CLI_API_URI} is not a valid. Exiting.`, true);
}

// TODO: handle multiple workflow files (see #32)
if (SWA_WORKFLOW_CONFIG_FILE) {
  logger.info(`\nFound workflow file:\n    ${chalk.green(SWA_WORKFLOW_CONFIG_FILE)}`);
}

const httpsServerOptions: Pick<https.ServerOptions, "cert" | "key"> | null = SWA_CLI_APP_SSL
  ? {
      cert: fs.readFileSync(SWA_CLI_APP_SSL_CERT, "utf8"),
      key: fs.readFileSync(SWA_CLI_APP_SSL_KEY, "utf8"),
    }
  : null;

const SWA_PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const logRequest = (req: http.IncomingMessage, target: string | null = null, statusCode: number | null = null) => {
  if (process.env.SWA_CLI_BEBUG?.includes("req") === false) {
    return;
  }

  const host = target || `${PROTOCOL}://${req.headers.host}`;
  const url = req.url?.startsWith("/") ? req.url : `/${req.url}`;

  if (statusCode) {
    logger.log(`${chalk.cyan(req.method)} ${host}${url} - ${chalk.green(statusCode)}`);
  } else {
    logger.log(chalk.yellow(`${req.method} ${host + url} (proxy)`));
  }
};

const serve = (root: string, req: http.IncomingMessage, res: http.ServerResponse) => {
  // if the requested file is not foud on disk
  // send our SWA 404 default page instead of serve-static's one.
  const file = path.join(root, req.url!);
  if (fs.existsSync(file) === false) {
    req.url = "404.html";
    res.statusCode = 404;
    root = SWA_PUBLIC_DIR;
  }

  logger.silly(`serving static content from:`);
  logger.silly({ root, file, url: req.url, statusCode: res.statusCode });

  const done = finalhandler(req, res) as any;
  return serveStatic(root, { extensions: ["html"] })(req, res, done);
};

const onConnectionLost = (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, target: string) => (error: Error) => {
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

const injectClientPrincipalCookies = (req: http.IncomingMessage) => {
  const cookie = req.headers.cookie;
  if (cookie && validateCookie(cookie)) {
    const user = decodeCookie(cookie);
    const buff = Buffer.from(JSON.stringify(user), "utf-8");
    req.headers["x-ms-client-principal"] = buff.toString("base64");
  }
};

const handleUserConfig = async (appLocation: string): Promise<SWAConfigFile | undefined> => {
  if (!fs.existsSync(appLocation)) {
    return;
  }

  const configFile = await findSWAConfigFile(appLocation);
  if (!configFile) {
    return;
  }

  let configJson: SWAConfigFile | undefined;
  try {
    configJson = require(configFile.file) as SWAConfigFile;
    configJson.isLegacyConfigFile = configFile.isLegacyConfigFile;

    logger.info(`\nFound configuration file:\n    ${chalk.green(configFile.file)}`);

    if (configFile.isLegacyConfigFile) {
      logger.info(
        `    ${chalk.yellow(`WARNING: Functionality defined in the routes.json file is now deprecated.`)}\n` +
          `    ${chalk.yellow(`Read more: https://docs.microsoft.com/azure/static-web-apps/configuration#routes`)}`
      );
    }

    return configJson;
  } catch (error) {}

  return configJson;
};

const isApiUrl = (req: http.IncomingMessage) => req.url?.startsWith(`/${DEFAULT_CONFIG.apiPrefix}`);
const isAuthUrl = (req: http.IncomingMessage) => req.url?.startsWith("/.auth");
const isSWAConfigFileUrl = (req: http.IncomingMessage) =>
  req.url?.endsWith(`/${DEFAULT_CONFIG.swaConfigFilename!}`) || req.url?.endsWith(`/${DEFAULT_CONFIG.swaConfigFilenameLegacy!}`);

const pageNotFoundResponse = async (req: http.IncomingMessage, res: http.ServerResponse, userConfig: SWAConfigFile | undefined) => {
  req.url = "/page-not-found.html";
  res.setHeader("Content-Type", "text/html");
  res.statusCode = 404;

  if (userConfig?.responseOverrides) {
    await responseOverrides(req, res, userConfig?.responseOverrides);
  }

  logRequest(req, PROTOCOL + "://" + req.headers.host, 404);
};

const authResponse = async (req: http.IncomingMessage, res: http.ServerResponse, userConfig: SWAConfigFile | undefined) => {
  const statusCode = await processAuth(req, res);
  if (statusCode === 404) {
    await pageNotFoundResponse(req, res, userConfig);
  }

  logRequest(req, null, statusCode);
};

const apiResponse = (req: http.IncomingMessage, res: http.ServerResponse) => {
  logger.silly(`+ api response:`);

  const target = SWA_CLI_API_URI;

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
};

const handleStaticFileResponse = (req: http.IncomingMessage, res: http.ServerResponse) => {
  let target = SWA_CLI_OUTPUT_LOCATION;

  // is this a dev server?
  if (isStaticDevServer) {
    proxyApp.web(
      req,
      res,
      {
        target,
        secure: false,
        toProxy: true,
      },
      onConnectionLost(req, res, target)
    );
    proxyApp.once("proxyRes", (proxyRes: http.IncomingMessage, req: http.IncomingMessage) => {
      logRequest(req, null, proxyRes.statusCode);
    });
  } else {
    const isCustomUrl = req.url?.startsWith(DEFAULT_CONFIG.customUrlScheme!);
    if (isCustomUrl) {
      // extract user custom page filename
      req.url = req.url?.replace(DEFAULT_CONFIG.customUrlScheme!, "");
      target = SWA_CLI_OUTPUT_LOCATION;
    } else {
      if (DEFAULT_CONFIG.overridableErrorCode?.includes(res.statusCode)) {
        target = SWA_PUBLIC_DIR;
      }
    }
  }

  return {
    target,
  };
};

const unauthorizedResponse = async (req: http.IncomingMessage, res: http.ServerResponse, userConfig: SWAConfigFile | undefined) => {
  req.url = "/unauthorized.html";
  res.setHeader("ContentType", "text/html");
  res.statusCode = 403;

  if (userConfig?.responseOverrides) {
    await responseOverrides(req, res, userConfig?.responseOverrides);
    const isCustomUrl = req.url.startsWith(DEFAULT_CONFIG.customUrlScheme!);
    if (isCustomUrl) {
      // extract user custom url
      req.url = req.url.replace(`${DEFAULT_CONFIG.customUrlScheme}`, "");
    }
  }

  logRequest(req, null, res.statusCode);
};

const redirectResponse = (_req: http.IncomingMessage, res: http.ServerResponse) => {
  if (res.getHeader("Location")) {
    return res.end();
  }
};

const requestHandler = (userConfig: SWAConfigFile | undefined) =>
  async function (req: http.IncomingMessage, res: http.ServerResponse) {
    if (!req.url) {
      return;
    }

    logger.silly(`-------------- processing route (start) ----------------`);
    logger.silly(`processing URL ${chalk.yellow(req.url)}`);

    logger.silly(`-------------- request middleware (start) --------------`);

    const matchingRouteRule = getMatchingRouteRule(req, userConfig);

    if (matchingRouteRule) {
      customRoutes(req, res, matchingRouteRule);
    }

    if (!isAuthorizedRoute(req, matchingRouteRule)) {
      await unauthorizedResponse(req, res, userConfig!);
    }

    if (matchingRouteRule?.redirect) {
      return redirectResponse(req, res);
    }

    if (matchingRouteRule?.rewrite) {
      req.url = matchingRouteRule.rewrite;
    }

    if (isAuthUrl(req)) {
      logger.silly(`+ Auth response:`);
      return authResponse(req, res, userConfig);
    }

    if (isApiUrl(req)) {
      return apiResponse(req, res);
    }

    // don't serve staticwebapp.config.json / routes.json
    if (isSWAConfigFileUrl(req)) {
      await pageNotFoundResponse(req, res, userConfig);
    }
    logger.silly(`-------------- request middleware (end) -----------------`);

    let { target } = handleStaticFileResponse(req, res);

    logger.silly(`-------------- response middleware (start) --------------`);

    const file = path.join(SWA_CLI_OUTPUT_LOCATION, req.url!);
    if (fs.existsSync(file) === false) {
      await pageNotFoundResponse(req, res, userConfig);
    }

    if (res.statusCode === 404 && userConfig?.navigationFallback) {
      await navigationFallback(req, res, userConfig?.navigationFallback);
    }

    if (userConfig?.responseOverrides) {
      await responseOverrides(req, res, userConfig.responseOverrides);
    }

    if (userConfig?.globalHeaders) {
      await globalHeaders(req, res, userConfig.globalHeaders);
    }

    if (matchingRouteRule?.headers) {
      for (const header in matchingRouteRule.headers) {
        if (matchingRouteRule.headers[header] === "") {
          res.removeHeader(header);

          logger.silly(` - removing route header: ${header}`);
        } else {
          res.setHeader(header, matchingRouteRule.headers[header]);

          logger.silly(` - adding route header: ${header}=${matchingRouteRule.headers[header]}`);
        }
      }
    }

    if (userConfig?.mimeTypes) {
      await mimeTypes(req, res, userConfig.mimeTypes);
    }

    logger.silly(`-------------- response middleware (end) --------------`);

    const isCustomUrl = req.url.startsWith(DEFAULT_CONFIG.customUrlScheme!);
    if (isCustomUrl) {
      // extract user custom url
      req.url = req.url.replace(`${DEFAULT_CONFIG.customUrlScheme}`, "");
    }
    serve(target, req, res);

    logger.silly(`-------------- processing route (end) -----------------`);
  };

// start SWA proxy server
(async () => {
  let socketConnection: net.Socket | undefined;
  const localIpAdress = await internalIp.v4();

  const onWsUpgrade = function (req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    socketConnection = socket;
    const target = SWA_CLI_OUTPUT_LOCATION;
    if (isStaticDevServer) {
      logger.log(chalk.green("** WebSocket connection established **"));

      proxyApp.ws(
        req,
        socket,
        head,
        {
          target,
          secure: false,
        },
        onConnectionLost(req, socket, target)
      );
    }
  };

  const onServerStart = async () => {
    if (isStaticDevServer) {
      // prettier-ignore
      logger.log(
        `\nUsing dev server for static content:\n`+
        `    ${chalk.green(SWA_CLI_OUTPUT_LOCATION)}`
      );
    } else {
      // prettier-ignore
      logger.log(
        `\nServing static content:\n` +
        `    ${chalk.green(SWA_CLI_OUTPUT_LOCATION)}`
        );
    }

    if (SWA_CLI_API_LOCATION) {
      if (isApiDevServer) {
        // prettier-ignore
        logger.log(
          `\nUsing dev server for API:\n`+
          `    ${chalk.green(SWA_CLI_API_LOCATION)}`
        );
      } else {
        // prettier-ignore
        logger.log(
          `\nServing API:\n` +
          `    ${chalk.green(SWA_CLI_API_LOCATION)}`
          );
      }
    }

    // prettier-ignore
    logger.log(
      `\nAvailable on:\n` +
      `    ${chalk.green(address(`${localIpAdress}`, SWA_CLI_PORT, PROTOCOL))}\n` +
      `    ${chalk.green(address(SWA_CLI_HOST, SWA_CLI_PORT, PROTOCOL))}\n\n` +
      `Azure Static Web Apps emulator started. Press CTRL+C to exit.\n\n`
    );

    server.on("upgrade", onWsUpgrade);

    registerProcessExit(() => {
      logger.info("Azure Static Web Apps emulator shutting down...");
      socketConnection?.end(() => logger.info("WebSocket connection closed."));
      server.close(() => logger.log("Server stopped."));
      proxyApi.close(() => logger.log("Api proxy stopped."));
      proxyApp.close(() => logger.log("App proxy stopped."));
      process.exit(0);
    });
  };

  // load user custom rules if running in local mode (non-dev server)
  let userConfig: SWAConfigFile | undefined;
  if (!isStaticDevServer) {
    userConfig = await handleUserConfig(SWA_CLI_ROUTES_LOCATION || SWA_CLI_APP_LOCATION);
  }
  const createServer = () => {
    if (SWA_CLI_APP_SSL && httpsServerOptions !== null) {
      return https.createServer(httpsServerOptions, requestHandler(userConfig));
    }
    return http.createServer(requestHandler(userConfig));
  };

  if (isStaticDevServer) {
    await validateDevServerConfig(SWA_CLI_OUTPUT_LOCATION);
  }
  const isApi = Boolean(SWA_CLI_API_LOCATION && SWA_CLI_API_URI);
  if (isApi) {
    await validateDevServerConfig(SWA_CLI_API_URI);
  }

  const server = createServer();
  server.listen(SWA_CLI_PORT, SWA_CLI_HOST, onServerStart);
  server.listen(SWA_CLI_PORT, localIpAdress);
})();
