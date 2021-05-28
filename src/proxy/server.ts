import chalk from "chalk";
import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import https from "https";
import internalIp from "internal-ip";
import net from "net";
import { address, isHttpUrl, logger, registerProcessExit, validateDevServerConfig } from "../core";
import {
  HAS_API,
  IS_API_DEV_SERVER,
  IS_APP_DEV_SERVER,
  SWA_CLI_API_LOCATION,
  SWA_CLI_API_URI,
  SWA_CLI_APP_LOCATION,
  SWA_CLI_APP_PROTOCOL,
  SWA_CLI_APP_SSL,
  SWA_CLI_APP_SSL_CERT,
  SWA_CLI_APP_SSL_KEY,
  SWA_CLI_HOST,
  SWA_CLI_OUTPUT_LOCATION,
  SWA_CLI_PORT,
  SWA_CLI_ROUTES_LOCATION,
  SWA_WORKFLOW_CONFIG_FILE,
} from "../core/utils/constants";
import { handleUserConfig, mshaMiddleware, onConnectionLost } from "./request-middleware";

const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });

if (!isHttpUrl(SWA_CLI_API_URI())) {
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

function requestHandler(userConfig: SWAConfigFile | undefined) {
  return async function (req: http.IncomingMessage, res: http.ServerResponse) {
    await mshaMiddleware(req, res, proxyApp, userConfig);
  };
}

function onWsUpgrade() {
  return (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    const target = SWA_CLI_OUTPUT_LOCATION;
    if (IS_APP_DEV_SERVER()) {
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
}

function onServerStart(server: https.Server | http.Server, socketConnection: net.Socket | undefined, localIpAdress: string | undefined) {
  return () => {
    if (IS_APP_DEV_SERVER()) {
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
      if (IS_API_DEV_SERVER()) {
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
      `    ${chalk.green(address(SWA_CLI_HOST, SWA_CLI_PORT, SWA_CLI_APP_PROTOCOL))}\n\n`
    );
    if (localIpAdress) {
      logger.log(`    ${chalk.green(address(`${localIpAdress}`, SWA_CLI_PORT, SWA_CLI_APP_PROTOCOL))}\n`);
    }

    // note: this string must not change. It is used by the VS Code extension.
    // see: https://github.com/Azure/static-web-apps-cli/issues/124
    //--------------------------------------------------------------------------------
    logger.log(`Azure Static Web Apps emulator started. Press CTRL+C to exit.\n\n`);
    //--------------------------------------------------------------------------------

    server.on("upgrade", onWsUpgrade());

    registerProcessExit(() => {
      logger.info("Azure Static Web Apps emulator shutting down...");
      socketConnection?.end(() => logger.info("WebSocket connection closed."));
      server.close(() => logger.log("Server stopped."));
      proxyApp.close(() => logger.log("App proxy stopped."));
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
  if (!IS_APP_DEV_SERVER()) {
    userConfig = await handleUserConfig(SWA_CLI_ROUTES_LOCATION || SWA_CLI_APP_LOCATION);
  }
  const createServer = () => {
    if (SWA_CLI_APP_SSL && httpsServerOptions !== null) {
      return https.createServer(httpsServerOptions, requestHandler(userConfig));
    }
    return http.createServer(requestHandler(userConfig));
  };

  if (IS_APP_DEV_SERVER()) {
    await validateDevServerConfig(SWA_CLI_OUTPUT_LOCATION);
  }

  if (HAS_API) {
    await validateDevServerConfig(SWA_CLI_API_URI());
  }

  const server = createServer();
  server.listen(SWA_CLI_PORT, SWA_CLI_HOST, onServerStart(server, socketConnection, localIpAdress));
  server.listen(SWA_CLI_PORT, localIpAdress);
})();
