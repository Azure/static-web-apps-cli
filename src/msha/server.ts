import chalk from "chalk";
import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import https from "https";
import internalIp from "internal-ip";
import net from "net";
import open from "open";
import { DEFAULT_CONFIG } from "../config";
import { address, hostnameToIpAdress, isHttpUrl, logger, logRequest, registerProcessExit, validateDevServerConfig } from "../core";
import { HAS_API, IS_API_DEV_SERVER, IS_APP_DEV_SERVER, SWA_CLI_API_URI, SWA_CLI_APP_PROTOCOL } from "../core/constants";
import { swaCLIEnv } from "../core/env";
import { validateFunctionTriggers } from "./handlers/function.handler";
import { handleUserConfig, onConnectionLost, requestMiddleware } from "./middlewares/request.middleware";

const { SWA_CLI_PORT } = swaCLIEnv();

const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });

if (!isHttpUrl(SWA_CLI_API_URI())) {
  logger.error(`The provided API URI ${SWA_CLI_API_URI} is not a valid. Exiting.`, true);
}

// TODO: handle multiple workflow files (see #32)
if (DEFAULT_CONFIG.githubActionWorkflowLocation) {
  logger.log(`\nUsing workflow file:\n  ${chalk.green(DEFAULT_CONFIG.githubActionWorkflowLocation)}`);
}

const httpsServerOptions: Pick<https.ServerOptions, "cert" | "key"> | null =
  DEFAULT_CONFIG.ssl && DEFAULT_CONFIG.sslCert && DEFAULT_CONFIG.sslKey
    ? {
        cert: DEFAULT_CONFIG.sslCert.startsWith("-----BEGIN") ? DEFAULT_CONFIG.sslCert : fs.readFileSync(DEFAULT_CONFIG.sslCert, "utf8"),
        key: DEFAULT_CONFIG.sslKey.startsWith("-----BEGIN") ? DEFAULT_CONFIG.sslKey : fs.readFileSync(DEFAULT_CONFIG.sslKey, "utf8"),
      }
    : null;

function requestHandler(userConfig: SWAConfigFile | undefined) {
  return async function (req: http.IncomingMessage, res: http.ServerResponse) {
    await requestMiddleware(req, res, proxyApp, userConfig);
  };
}

function onWsUpgrade() {
  return (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    if (IS_APP_DEV_SERVER()) {
      const target = DEFAULT_CONFIG.outputLocation;
      const remote = `ws://${req.headers.host}`;
      logRequest(req, remote);

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
      proxyApp.once("proxyRes", (proxyRes: http.IncomingMessage) => {
        logger.silly(`getting response from dev server`);

        logRequest(req, remote, proxyRes.statusCode);
      });
    }
  };
}

function onServerStart(server: https.Server | http.Server, socketConnection: net.Socket | undefined) {
  return () => {
    if (IS_APP_DEV_SERVER()) {
      // prettier-ignore
      logger.log(
        `\nUsing dev server for static content:\n` +
        `  ${chalk.green(DEFAULT_CONFIG.outputLocation)}`
      );
    } else {
      // prettier-ignore
      logger.log(
        `\nServing static content:\n` +
        `  ${chalk.green(DEFAULT_CONFIG.outputLocation)}`
      );
    }

    if (DEFAULT_CONFIG.apiLocation) {
      if (IS_API_DEV_SERVER()) {
        // prettier-ignore
        logger.log(
          `\nUsing dev server for API:\n` +
          `  ${chalk.green(DEFAULT_CONFIG.apiLocation)}`
        );
      } else {
        // prettier-ignore
        logger.log(
          `\nServing API:\n` +
          `  ${chalk.green(DEFAULT_CONFIG.apiLocation)}`
        );
      }
    }

    // note: this string must not change. It is used by the VS Code extension.
    // see: https://github.com/Azure/static-web-apps-cli/issues/124
    //--------------------------------------------------------------------------------
    const serverAddress = address(DEFAULT_CONFIG.host, Number(SWA_CLI_PORT), SWA_CLI_APP_PROTOCOL);
    let logMessage = `\nAzure Static Web Apps emulator started at ${chalk.green(serverAddress)}. Press CTRL+C to exit.\n\n`;
    //--------------------------------------------------------------------------------

    logger.log(logMessage);

    if (DEFAULT_CONFIG.open) {
      open(serverAddress);
    }

    server.on("upgrade", onWsUpgrade());

    registerProcessExit(() => {
      socketConnection?.end(() => logger.info("WebSocket connection closed."));
      server.close(() => logger.log("Server stopped."));
      proxyApp.close(() => logger.log("App proxy stopped."));
      logger.info("Azure Static Web Apps emulator shutting down...");
      process.exit(0);
    });
  };
}

// start SWA proxy server
(async () => {
  let socketConnection: net.Socket | undefined;
  const localIpAdress = await internalIp.v4();

  // load user custom rules if running in local mode (non-dev server)
  let userConfig: SWAConfigFile | undefined;
  // load user configuration even when using a dev server
  userConfig = await handleUserConfig(DEFAULT_CONFIG.swaConfigLocation || DEFAULT_CONFIG.appLocation);

  const createServer = () => {
    if (DEFAULT_CONFIG.ssl && httpsServerOptions !== null) {
      return https.createServer(httpsServerOptions, requestHandler(userConfig));
    }
    return http.createServer(requestHandler(userConfig));
  };

  if (IS_APP_DEV_SERVER()) {
    await validateDevServerConfig(DEFAULT_CONFIG.outputLocation, DEFAULT_CONFIG.devserverTimeout);
  }

  if (HAS_API) {
    await validateDevServerConfig(SWA_CLI_API_URI() as string, DEFAULT_CONFIG.devserverTimeout);
    await validateFunctionTriggers(SWA_CLI_API_URI() as string);
  }

  const server = createServer();
  server.listen(Number(SWA_CLI_PORT), hostnameToIpAdress(DEFAULT_CONFIG.host), onServerStart(server, socketConnection));
  server.listen(Number(SWA_CLI_PORT), localIpAdress);
})();
