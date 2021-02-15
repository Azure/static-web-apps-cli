import fs from "fs";
import path from "path";
import http from "http";
import httpProxy from "http-proxy";
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyAuth = httpProxy.createProxyServer({ autoRewrite: false });
import { decodeCookie, isHttpUrl, validateCookie } from "./utils";
import { DEFAULT_CONFIG } from "./cli/config";

const buildAdress = (host: string, port: number | string | undefined) => `http://${host}:${port}`;

const SWA_CLI_HOST = process.env.SWA_CLI_HOST as string;
const SWA_CLI_PORT = parseInt(process.env.SWA_CLI_PORT || "", 10);
const SWA_CLI_APP_URI = buildAdress(SWA_CLI_HOST, process.env.SWA_CLI_APP_PORT);
const SWA_CLI_API_URI = buildAdress(SWA_CLI_HOST, process.env.SWA_CLI_API_PORT);
const SWA_CLI_AUTH_URI = buildAdress(SWA_CLI_HOST, process.env.SWA_CLI_AUTH_PORT);
const SWA_CLI_APP_ARTIFACT_LOCATION = process.env.SWA_CLI_APP_ARTIFACT_LOCATION;

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

const SWA_404 = path.resolve(process.cwd(), "..", "public", "404.html");
const SWA_401 = path.resolve(process.cwd(), "..", "public", "unauthorized.html");

type UserDefinedRoute = {
  route: string;
  allowedRoles?: string[];
  statusCode?: number;
  serve?: string;
};

const serveStatic = (file: string, res: http.ServerResponse, status = 200) => {
  if (status !== 401) {
    file = fs.existsSync(file) ? file : SWA_404;
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

const readRoutes = (folder: string): UserDefinedRoute[] => {
  if (!fs.existsSync(folder)) {
    return [];
  }

  const routesFile = fs.readdirSync(folder).find((file) => file.endsWith("routes.json"));

  if (!routesFile) {
    return [];
  }

  return require(path.join(folder, routesFile)).routes || [];
};

const routes = readRoutes(SWA_CLI_APP_ARTIFACT_LOCATION || "");

const routeTest = (userDefinedRoute: string, currentRoute: string) => {
  if (userDefinedRoute === currentRoute) {
    return true;
  }

  if (userDefinedRoute.endsWith("*")) {
    return currentRoute.startsWith(userDefinedRoute.replace("*", ""));
  }

  return false;
};

const server = http.createServer(function (req, res) {
  // not quite sure how you'd hit an undefined url, but the types say you can
  if (!req.url) {
    return;
  }

  const userDefinedRoute = routes.find((route) => req.url!.endsWith(route.route));

  // something from the `routes.json`
  if (userDefinedRoute && routeTest(userDefinedRoute.route, req.url)) {
    // access control defined
    if (userDefinedRoute.allowedRoles) {
      const user = decodeCookie(req.headers.cookie);
      if (!userDefinedRoute.allowedRoles.some((role) => user.userRoles.some((ur: string) => ur === role))) {
        serveStatic(SWA_401, res, 401);
        return;
      }
    }

    // Wanting a specific status code but no attached route
    else if (userDefinedRoute.statusCode && !userDefinedRoute.serve) {
      if (userDefinedRoute.statusCode === 404) {
        serveStatic(SWA_404, res);
        return;
      } else {
        res.writeHead(userDefinedRoute.statusCode);
        res.end();
        return;
      }
    }

    // Want a redirect route
    else if (userDefinedRoute.serve) {
      req.url = userDefinedRoute.serve;
    }
  }

  // proxy AUTH request to AUTH emulator
  if (req.url.startsWith("/.auth")) {
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

  // detected a proxy pass-through from http-server, so 404 it
  else if (req.url.startsWith("/routes.json")) {
    console.log("proxy>", req.method, req.headers.host + req.url);
    serveStatic(SWA_404, res);
  }

  // detected SPA mode
  else if (req.url.startsWith("/?")) {
    console.log("proxy>", req.method, req.headers.host + req.url);
    const fileIndex = path.join(SWA_CLI_APP_ARTIFACT_LOCATION || "", "index.html");
    serveStatic(fileIndex, res);
  }

  // proxy APP request to local APP
  else {
    const target = SWA_CLI_APP_URI;
    console.log("app>", req.method, target + req.url);

    proxyApp.web(req, res, {
      target,
      secure: false,
    });
  }
});

proxyApp.on("error", function (err) {
  console.error("app>", err.toString());
});

const port = SWA_CLI_PORT;
const host = SWA_CLI_HOST;
const address = `http://${host}:${port}`;
console.log(`SWA listening on ${address}`);
server.on("upgrade", function (req, socket, head) {
  console.log("app>", "Upgrading WebSocket");
  proxyApp.ws(req, socket, head, {
    target: SWA_CLI_APP_URI,
    secure: false,
  });
});
server.listen(port, host);
