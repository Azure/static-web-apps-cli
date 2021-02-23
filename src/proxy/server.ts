import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import path from "path";
import { DEFAULT_CONFIG } from "../config";
import { decodeCookie, isHttpUrl, validateCookie } from "../core/utils";
import { handleUserConfig, processUserRoute } from "./routes-engine";
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyAuth = httpProxy.createProxyServer({ autoRewrite: false });

const address = (host: string, port: number | string | undefined) => `http://${host}:${port}`;

const SWA_CLI_HOST = process.env.SWA_CLI_HOST as string;
const SWA_CLI_PORT = parseInt(process.env.SWA_CLI_PORT || "", 10);
const SWA_CLI_APP_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_APP_PORT);
const SWA_CLI_API_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_API_PORT);
const SWA_CLI_AUTH_URI = address(SWA_CLI_HOST, process.env.SWA_CLI_AUTH_PORT);
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

// make SWA assets referencable
const SWA_404 = path.resolve(process.cwd(), "..", "public", "404.html");
const SWA_401 = path.resolve(process.cwd(), "..", "public", "unauthorized.html");
const htmlAssets: Record<string, string> = { SWA_404, SWA_401 };

const serveStatic = (file: string, res: http.ServerResponse, status = 200) => {
  if (status !== 401) {
    file = fs.existsSync(file) ? file : htmlAssets["SWA_404"];
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

const injectClientPrincipalCookies = (cookie: string | undefined, proxyReqOrRes: http.ServerResponse | http.ClientRequest) => {
  if (cookie && validateCookie(cookie)) {
    const user = decodeCookie(cookie);
    const buff = Buffer.from(JSON.stringify(user), "utf-8");
    proxyReqOrRes.setHeader("x-ms-client-principal", buff.toString("base64"));
  }
};

const requestHandler = (userConfig: UserConfig) =>
  async function (req: http.IncomingMessage, res: http.ServerResponse) {
    // not quite sure how you'd hit an undefined url, but the types say you can
    if (!req.url) {
      return;
    }

    const status = await processUserRoute(req, res, userConfig.userDefinedRoutes);

    // handle redirects
    if (status) {
      const override = userConfig.userDefinedResponseOverrides[`${status}`] || null;
      if (override) {
        res.writeHead(override.statusCode, { Location: override.redirect });
      } else if ([401, 404].includes(status)) {
        return serveStatic(htmlAssets[`SWA_${status}`], res, status);
      }
    }

    // don't serve user custom routes file
    if (DEFAULT_CONFIG.swaConfigFilePattern?.test(req.url)) {
      console.log("proxy>", req.method, req.headers.host + req.url);
      serveStatic(htmlAssets["SWA_404"], res);
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
    else if (req.url?.startsWith(`/${DEFAULT_CONFIG.apiPrefix}`)) {
      const target = SWA_CLI_API_URI;
      console.log("api>", req.method, target + req.url);

      proxyApi.web(req, res, {
        target,
      });
      proxyApi.on("error", function (err, req) {
        console.log("api>>", req.method, target + req.url);
        console.log(err.message);
        proxyApi.close();
      });
      proxyApi.on("proxyReq", (proxyReq, req) => {
        injectClientPrincipalCookies(req.headers.cookie, proxyReq);
      });
      proxyApi.on("proxyRes", function (_proxyRes, req) {
        injectClientPrincipalCookies(req.headers.cookie, res);
      });
    }

    // detected SPA mode
    else if (req.url?.startsWith("/?")) {
      console.log("proxy>", req.method, req.headers.host + req.url);
      const fileIndex = path.join(SWA_CLI_APP_ARTIFACT_LOCATION || "", "index.html");
      serveStatic(fileIndex, res);
    }

    // proxy APP request to local APP
    else {
      const target = SWA_CLI_APP_URI;
      console.log(req.method, target + req.url);

      proxyApp.web(req, res, {
        target,
        secure: false,
      });
    }
  };

proxyApp.on("error", function (err) {
  console.error(err.toString());
});

// start server
(async () => {
  http
    .createServer(requestHandler(await handleUserConfig(SWA_CLI_APP_ARTIFACT_LOCATION)))
    .on("upgrade", function (req, socket, head) {
      console.log("Upgrading WebSocket");
      proxyApp.ws(req, socket, head, {
        target: SWA_CLI_APP_URI,
        secure: false,
      });
    })
    .listen(SWA_CLI_PORT, SWA_CLI_HOST, () => {
      console.log(`SWA listening on ${address(SWA_CLI_HOST, SWA_CLI_PORT)}`);
    });
})();
