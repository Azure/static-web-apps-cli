import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import path from "path";
import { DEFAULT_CONFIG } from "../config";
import { decodeCookie, findSWAConfigFile, isHttpUrl, validateCookie } from "../core/utils";
import { customRoutes, globalHeaders, mimeTypes, responseOverrides } from "./routes-engine/index";

const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyAuth = httpProxy.createProxyServer({ autoRewrite: false });

const address = (host: string, port: number | string | undefined) => `http://${host}:${port}`;

const SWA_CLI_HOST = process.env.SWA_CLI_HOST as string;
const SWA_CLI_PORT = parseInt(process.env.SWA_CLI_PORT || "", 10);
const SWA_CLI_APP_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_APP_PORT);
const SWA_CLI_API_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_API_PORT);
const SWA_CLI_AUTH_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_AUTH_PORT);
const SWA_CLI_APP_LOCATION = process.env.SWA_CLI_APP_LOCATION || ".";
const SWA_CLI_APP_ARTIFACT_LOCATION = process.env.SWA_CLI_APP_ARTIFACT_LOCATION || ".";

if (!isHttpUrl(SWA_CLI_APP_URI)) {
  console.log(`The provided app URI is not a valid`);
  console.log(`Got: ${SWA_CLI_APP_URI}`);
  console.log(`Abort.`);
  process.exit(-1);
}
if (!isHttpUrl(SWA_CLI_API_URI)) {
  console.log(`The provided API URI is not a valid`);
  console.log(`Got: ${SWA_CLI_API_URI}`);
  console.log(`Abort.`);
  process.exit(-1);
}
if (!isHttpUrl(SWA_CLI_AUTH_URI)) {
  console.log(`The provided auth URI is not a valid`);
  console.log(`Got: ${SWA_CLI_AUTH_URI}`);
  console.log(`Abort.`);
  process.exit(-1);
}

const SWA_NOT_FOUND = path.resolve(process.cwd(), "..", "public", "404.html");
const SWA_UNAUTHORIZED = path.resolve(process.cwd(), "..", "public", "unauthorized.html");

const serveStatic = (file: string, res: http.ServerResponse, status = 200) => {
  if (status !== 401) {
    file = fs.existsSync(file) ? file : SWA_NOT_FOUND;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(status);
    res.end(data);
  });
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
          userConfig.routes,
        ]
        );

      switch (res.statusCode) {
        case 401:
          return serveStatic(SWA_UNAUTHORIZED, res, 401);
        case 403:
          // @TODO provide a Forbidden HTML template
          return serveStatic(SWA_UNAUTHORIZED, res, 403);
        case 404:
          return serveStatic(SWA_NOT_FOUND, res, 404);
        default:
          break;
      }
    }

    // don't serve user custom routes file
    if (req.url.endsWith(DEFAULT_CONFIG.swaConfigFilename!) || req.url.endsWith(DEFAULT_CONFIG.swaConfigFilenameLegacy!)) {
      console.log("proxy>", req.method, req.headers.host + req.url);
      serveStatic(SWA_NOT_FOUND, res);
    }

    // proxy AUTH request to AUTH emulator
    else if (req.url?.startsWith("/.auth")) {
      const target = SWA_CLI_AUTH_URI;
      req.url = `/app${req.url}`;

      console.log("auth>", req.method, target + req.url);
      proxyAuth.web(req, res, {
        target,
      });
      proxyAuth.on("proxyRes", function (proxyRes, req) {
        console.log("auth>>", req.method, target + req.url);
        console.log(JSON.stringify(proxyRes.headers, undefined, 2));
      });
      proxyAuth.on("error", function (err, req) {
        console.log("auth>>", req.method, target + req.url);
        console.log(err.message);
        proxyAuth.close();
      });
    }

    // proxy API request to local API
    else if (req.url.startsWith(`/${DEFAULT_CONFIG.apiPrefix}`)) {
      const target = SWA_CLI_API_URI;
      console.log("api>", req.method, target + req.url);

      injectClientPrincipalCookies(req.headers.cookie, req);
      proxyApi.web(req, res, {
        target,
      });
    }

    // detected SPA mode (see https://github.com/http-party/http-server#catch-all-redirect)
    else if (req.url?.startsWith("/?")) {
      console.log("proxy>", req.method, req.headers.host + req.url);
      const fileIndex = path.join(SWA_CLI_APP_ARTIFACT_LOCATION || "", "index.html");
      serveStatic(fileIndex, res);
    }

    // proxy APP requests to local APP server
    else {
      const target = SWA_CLI_APP_URI;
      console.log("app>", req.method, target + req.url);

      proxyApp.web(req, res, {
        target,
        secure: false,
        toProxy: true,
      });
    }
  };

proxyApp.on("error", function (err) {
  console.error("app>", err.toString());
});

// start server
(async () => {
  http
    .createServer(requestHandler(await handleUserConfig(SWA_CLI_APP_LOCATION)))
    .on("upgrade", function (req, socket, head) {
      console.log("app>", "Upgrading WebSocket");
      proxyApp.ws(req, socket, head, {
        target: SWA_CLI_APP_URI,
        secure: false,
      });
    })
    .listen(SWA_CLI_PORT, SWA_CLI_HOST, () => {
      console.log(`SWA listening on ${address(SWA_CLI_HOST, SWA_CLI_PORT)}`);
    });
})();
