import finalhandler from "finalhandler";
import fs from "fs";
import chalk from "chalk";
import internalIp from "internal-ip";
import http from "http";
import httpProxy from "http-proxy";
import net from "net";
import path from "path";
import serveStatic from "serve-static";
import { processAuth } from "../auth/";
import { DEFAULT_CONFIG } from "../config";
import { address, decodeCookie, findSWAConfigFile, isHttpUrl, registerProcessExit, validateCookie } from "../core/utils";
import { applyRules } from "./routes-engine/index";

const SWA_WORKFLOW_CONFIG_FILE = process.env.SWA_WORKFLOW_CONFIG_FILE as string;
const SWA_CLI_HOST = process.env.SWA_CLI_HOST as string;
const SWA_CLI_PORT = parseInt((process.env.SWA_CLI_PORT || DEFAULT_CONFIG.port) as string, 10);
const SWA_CLI_API_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_API_PORT);
const SWA_CLI_APP_LOCATION = (process.env.SWA_CLI_APP_LOCATION || DEFAULT_CONFIG.appLocation) as string;
const SWA_CLI_APP_ARTIFACT_LOCATION = (process.env.SWA_CLI_APP_ARTIFACT_LOCATION || DEFAULT_CONFIG.appArtifactLocation) as string;

const PROTOCOL = `http://`;

const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const isStaticDevServer = isHttpUrl(SWA_CLI_APP_ARTIFACT_LOCATION);

if (!isHttpUrl(SWA_CLI_API_URI)) {
  console.error(chalk.red(`The provided API URI ${SWA_CLI_API_URI} is not a valid. Exiting.`));
  process.exit(-1);
}

// TODO: handle multiple workflow files
if (SWA_WORKFLOW_CONFIG_FILE) {
  console.log(`Found workflow file:`);
  console.log(`    ${chalk.green(SWA_WORKFLOW_CONFIG_FILE)}`);
}

const SWA_PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const logRequest = (req: http.IncomingMessage, target: string | null = null, statusCode: number | null = null) => {
  const host = target || `${PROTOCOL}${req.headers.host}`;
  const url = req.url?.startsWith("/") ? req.url : `/${req.url}`;

  if (statusCode) {
    console.log(chalk.cyan(req.method), host + url, "-", chalk.green(statusCode));
  } else {
    console.log(chalk.yellow(`${req.method} ${host + url} (proxy)`));
  }
};

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
    console.error(chalk.red(`** Cannot reach ${target} **`));
  }
  (res as http.ServerResponse).statusCode = 500;
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

    console.log();
    console.log("Found configuration file:");
    console.log(`    ${chalk.green(configFile.file)}`);

    if (configFile.isLegacyConfigFile) {
      console.log(`    ${chalk.yellow(`WARNING: Functionality defined in the routes.json file is now deprecated.`)}`);
      console.log(`    ${chalk.yellow(`Read more: https://docs.microsoft.com/azure/static-web-apps/configuration#routes`)}`);
      console.log();
    }

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
      console.log("proxy>", req.method, PROTOCOL + req.headers.host + req.url, 404);
      req.url = "404.html";
      res.statusCode = 404;
      serve(SWA_PUBLIC_DIR, req, res);
    }

    // proxy AUTH request to AUTH emulator
    else if (req.url.startsWith("/.auth")) {
      const statusCode = await processAuth(req, res);
      if (statusCode === 404) {
        req.url = "404.html";
        res.statusCode = 404;
        serve(SWA_PUBLIC_DIR, req, res);
      }

      logRequest(req, null, statusCode);
    }

    // proxy API request to Azure Functions emulator
    else if (req.url.startsWith(`/${DEFAULT_CONFIG.apiPrefix}`)) {
      const target = SWA_CLI_API_URI;

      injectClientPrincipalCookies(req);
      proxyApi.web(
        req,
        res,
        {
          target,
        },
        onConnectionLost(res, target)
      );
      proxyApi.once("proxyRes", (proxyRes: http.IncomingMessage, req: http.IncomingMessage) => {
        logRequest(req, null, proxyRes.statusCode);
      });

      logRequest(req);
    }

    // proxy APP requests
    else {
      const target = SWA_CLI_APP_ARTIFACT_LOCATION;

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
          onConnectionLost(res, target)
        );
        proxyApp.once("proxyRes", (proxyRes: http.IncomingMessage, req: http.IncomingMessage) => {
          logRequest(req, null, proxyRes.statusCode);
        });

        logRequest(req);
      } else {
        serve(target, req, res);
        logRequest(req, null, res.statusCode);
      }
    }
  };

// start SWA proxy server
(async () => {
  let socketConnection: net.Socket | undefined;
  const localIpAdress = await internalIp.v4();

  const onWsUpgrade = function (req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    socketConnection = socket;
    const target = SWA_CLI_APP_ARTIFACT_LOCATION;
    if (isStaticDevServer) {
      console.log(chalk.green("** WebSocket connection established **"));

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

  const onServerStart = async () => {
    if (isStaticDevServer) {
      console.log(`Using dev server:`);
      console.log(`    ${chalk.green(SWA_CLI_APP_ARTIFACT_LOCATION)}`);

      server.on("upgrade", onWsUpgrade);
    } else {
      console.log(`Serving static content:`);
      console.log(`    ${chalk.green(SWA_CLI_APP_ARTIFACT_LOCATION)}`);
    }

    console.log();
    console.log(`Available on:`);
    console.log(`    ${chalk.green(address(`${localIpAdress}`, SWA_CLI_PORT))}`);
    console.log(`    ${chalk.green(address(SWA_CLI_HOST, SWA_CLI_PORT))}`);
    console.log();
    console.log(`Azure Static Web Apps emulator started. Press CTRL+C to exit.`);
    console.log();

    registerProcessExit(() => {
      socketConnection?.end(() => console.log("\nWebSocket connection closed."));
      server.close(() => console.log("\nServer stopped."));
      proxyApi.close();
      proxyApp.close();
    });
  };

  // load user custom rules if running in local mode (non-dev server)
  let userConfig = null;
  if (!isStaticDevServer) {
    userConfig = await handleUserConfig(SWA_CLI_APP_LOCATION);
  }
  const server = http.createServer(requestHandler(userConfig));
  server.listen(SWA_CLI_PORT, SWA_CLI_HOST, onServerStart);
  server.listen(SWA_CLI_PORT, localIpAdress);
})();
