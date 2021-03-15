import finalhandler from "finalhandler";
import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import net from "net";
import path from "path";
import serveStatic from "serve-static";
import { processAuth } from "../auth/";
import { DEFAULT_CONFIG } from "../config";
import { address, decodeCookie, findSWAConfigFile, isHttpUrl, registerProcessExit, validateCookie } from "../core/utils";
import { applyRules } from "./routes-engine/index";

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

const SWA_PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const serve = (root: string, req: http.IncomingMessage, res: http.ServerResponse) => {
  // if the requested file is not foud on disk
  // or if routes rule config is 404
  // send our 404 custom page instead of serve-static's one.
  const file = path.join(root, req.url!);
  if (fs.existsSync(file) === false) {
    req.url = "404.html";
    res.statusCode = 404;
    root = SWA_PUBLIC_DIR;
  }

  const done = finalhandler(req, res) as any;
  return serveStatic(root, { extensions: ["html"] })(req, res, done);
};

const onConnectionLost = (res: http.ServerResponse | net.Socket, target: string) => (error: Error) => {
  if (error.message.includes("ECONNREFUSED")) {
    console.info(`INFO: Cannot connect to ${target}.`);
  }
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

const handleUserConfig = async (appLocation: string): Promise<SWAConfigFile | null> => {
  if (!fs.existsSync(appLocation)) {
    return null;
  }

  const configFile = await findSWAConfigFile(appLocation);
  if (!configFile) {
    return null;
  }

  let configJson: SWAConfigFile | null = null;
  try {
    configJson = require(configFile.file) as SWAConfigFile;
    configJson.isLegacyConfigFile = configFile.isLegacyConfigFile;

    console.log("reading user config", configFile.file);
    return configJson;
  } catch (error) {}
  return configJson;
};

const requestHandler = (userConfig: SWAConfigFile | null) =>
  async function (req: http.IncomingMessage, res: http.ServerResponse) {
    // not quite sure how you'd hit an undefined url, but the types say you can
    if (!req.url) {
      return;
    }

    if (userConfig) {
      await applyRules(req, res, userConfig);

      if ([401, 403, 404].includes(res.statusCode)) {
        switch (res.statusCode) {
          case 401:
            req.url = "unauthorized.html";
            break;
          case 403:
            // @TODO provide a Forbidden HTML template
            req.url = "unauthorized.html";
            break;
          case 404:
            req.url = "404.html";
            break;
        }
        return serve(SWA_PUBLIC_DIR, req, res);
      }
    }

    // don't serve user custom routes file
    if (req.url.endsWith(DEFAULT_CONFIG.swaConfigFilename!) || req.url.endsWith(DEFAULT_CONFIG.swaConfigFilenameLegacy!)) {
      console.log("proxy>", req.method, `http://` + req.headers.host + req.url, 404);
      req.url = "404.html";
      res.statusCode = 404;
      serve(SWA_PUBLIC_DIR, req, res);
    }

    // proxy AUTH request to AUTH emulator
    else if (req.url.startsWith("/.auth")) {
      const statusCode = await processAuth(req, res);
      console.log("auth>", req.method, `http://` + req.headers.host! + req.url, statusCode);

      if (statusCode === 404) {
        req.url = "404.html";
        res.statusCode = 404;
        serve(SWA_PUBLIC_DIR, req, res);
      }
    }

    // proxy API request to Azure Functions emulator
    else if (req.url.startsWith(`/${DEFAULT_CONFIG.apiPrefix}`)) {
      const target = SWA_CLI_API_URI;
      console.log("api>", req.method, target + req.url);

      injectClientPrincipalCookies(req);
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
        console.log("app>", req.method, `http://` + req.headers.host + req.url);
        serve(target, req, res);
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
