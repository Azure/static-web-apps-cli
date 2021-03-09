import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import net from "net";
import path from "path";
import serveStatic from "serve-static";
import { processAuth } from "../auth/";
import { DEFAULT_CONFIG } from "../config";
import { address, decodeCookie, findSWAConfigFile, isHttpUrl, registerProcessExit, validateCookie } from "../core/utils";
import { customRoutes, globalHeaders, mimeTypes, responseOverrides } from "./routes-engine/index";
import { navigationFallback } from "./routes-engine/rules/navigationFallback";

const SWA_CLI_HOST = process.env.SWA_CLI_HOST as string;
const SWA_CLI_PORT = parseInt((process.env.SWA_CLI_PORT || DEFAULT_CONFIG.port) as string, 10);
const SWA_CLI_API_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_API_PORT);
const SWA_CLI_APP_LOCATION = (process.env.SWA_CLI_APP_LOCATION || DEFAULT_CONFIG.appLocation) as string;
const SWA_CLI_APP_ARTIFACT_LOCATION = (process.env.SWA_CLI_APP_ARTIFACT_LOCATION || DEFAULT_CONFIG.appArtifactLocation) as string;

const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const isStaticDevServer = isHttpUrl(SWA_CLI_APP_ARTIFACT_LOCATION);

if (!isHttpUrl(SWA_CLI_API_URI)) {
  console.log(`The provided API URI is not a valid`);
  console.log(`Got: ${SWA_CLI_API_URI}`);
  console.log(`Abort.`);
  process.exit(-1);
}

const SWA_NOT_FOUND = path.resolve(process.cwd(), "..", "public", "404.html");
const SWA_UNAUTHORIZED = path.resolve(process.cwd(), "..", "public", "unauthorized.html");

const onConnectionLost = (res: http.ServerResponse | net.Socket, target: string) => (error: Error) => {
  if (error.message.includes("ECONNREFUSED")) {
    console.info(`INFO: Cannot connect to ${target}.`);
  }
  res.end();
};

const injectClientPrincipalCookies = (cookie: string | undefined, req: http.IncomingMessage) => {
  if (cookie && validateCookie(cookie)) {
    const user = decodeCookie(cookie);
    const buff = Buffer.from(JSON.stringify(user), "utf-8");
    req.headers["x-ms-client-principal"] = buff.toString("base64");
  }
};

const handleUserConfig = async (appLocation: string): Promise<SWAConfigFile | null> => {
  if (!fs.existsSync(appLocation)) {
    return null;
  }

  const configFile = await findSWAConfigFile(appLocation);
  if (!configFile) {
    return null;
  }

  let config: SWAConfigFile | null = null;
  try {
    config = require(configFile) as SWAConfigFile;
    console.log("reading user config", configFile);
    return config;
  } catch (error) {}
  return config;
};

const pipeRules = (...rules: Array<Function>) => async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  args: Array<
    SWAConfigFileGlobalHeaders | SWAConfigFileMimeTypes | SWAConfigFileNavigationFallback | SWAConfigFileResponseOverrides | SWAConfigFileRoute[]
  >
) => {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    await rule(req, res, args[i]);
  }
};

const requestHandler = (userConfig: SWAConfigFile | null) =>
  async function (req: http.IncomingMessage, res: http.ServerResponse) {
    // not quite sure how you'd hit an undefined url, but the types say you can
    if (!req.url) {
      return;
    }

    if (userConfig) {
      // Note: process rules in this order (from left to right) because they mutate http.ServerResponse object
      // prettier-ignore
      const processRules = pipeRules(
        globalHeaders,
        mimeTypes,
        responseOverrides,
        navigationFallback,
        customRoutes,
      );
      // prettier-ignore
      await processRules(
        req,
        res,
        [
          userConfig.globalHeaders,
          userConfig.mimeTypes,
          userConfig.responseOverrides,
          userConfig.navigationFallback,
          userConfig.routes,
        ]
        );

      switch (res.statusCode) {
        case 401:
          return serveStatic(SWA_UNAUTHORIZED)(req, res, () => res.end());
        case 403:
          // @TODO provide a Forbidden HTML template
          return serveStatic(SWA_UNAUTHORIZED)(req, res, () => res.end());
        case 404:
          return serveStatic(SWA_NOT_FOUND)(req, res, () => res.end());
        default:
          break;
      }
    }

    // don't serve user custom routes file
    if (req.url.endsWith(DEFAULT_CONFIG.swaConfigFilename!) || req.url.endsWith(DEFAULT_CONFIG.swaConfigFilenameLegacy!)) {
      console.log("proxy>", req.method, req.headers.host + req.url);
      serveStatic(SWA_NOT_FOUND)(req, res, () => res.end());
    }

    // proxy AUTH request to AUTH emulator
    else if (req.url?.startsWith("/.auth")) {
      console.log("auth>", req.method, req.headers.host + req.url);
      await processAuth(req, res);
    }

    // proxy API request to Azure Functions emulator
    else if (req.url.startsWith(`/${DEFAULT_CONFIG.apiPrefix}`)) {
      const target = SWA_CLI_API_URI;
      console.log("api>", req.method, target + req.url);

      injectClientPrincipalCookies(req.headers.cookie, req);
      proxyApi.web(req, res, {
        target,
      });
    }

    // proxy APP requests
    else {
      const target = SWA_CLI_APP_ARTIFACT_LOCATION;

      // is this a dev server?
      if (isStaticDevServer) {
        console.log("app>", req.method, target + req.url);
        proxyApp.web(
          req,
          res,
          {
            target,
            secure: false,
            toProxy: true,
          },
          onConnectionLost(res, target)
        );
      } else {
        console.log("app>", req.method, req.url);
        serveStatic(target)(req, res, () => res.end());
      }
    }
  };

// start SWA proxy server
(async () => {
  let socketConnection: net.Socket | undefined;
  const onWsUpgrade = function (req: http.IncomingMessage, socket: net.Socket, head: any) {
    socketConnection = socket;
    const target = SWA_CLI_APP_ARTIFACT_LOCATION;
    if (isStaticDevServer) {
      console.log("app>", "WebSocket connection established.");
      proxyApp.ws(
        req,
        socket,
        head,
        {
          target,
          secure: false,
        },
        onConnectionLost(socket, target)
      );
    }
  };

  const onServerStart = () => {
    if (isStaticDevServer) {
      console.log(`listening at ${address(SWA_CLI_HOST, SWA_CLI_PORT)}`);
      console.log(`using dev server at ${SWA_CLI_APP_ARTIFACT_LOCATION}`);
      server.on("upgrade", onWsUpgrade);
    } else {
      console.log(`serving ${SWA_CLI_APP_ARTIFACT_LOCATION} at ${address(SWA_CLI_HOST, SWA_CLI_PORT)}`);
    }

    console.log(`press CTRL+C to exit`);
    registerProcessExit(() => {
      socketConnection?.end(() => console.log("\nWebSocket connection closed."));
      server.close(() => console.log("\nServer stopped."));
      proxyApi.close();
      proxyApp.close();
    });
  };

  const server = http.createServer(requestHandler(await handleUserConfig(SWA_CLI_APP_LOCATION))).listen(SWA_CLI_PORT, SWA_CLI_HOST, onServerStart);
})();
