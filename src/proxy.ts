import fs from "fs";
import path from "path";
import http from "http";
import httpProxy from "http-proxy";
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyAuth = httpProxy.createProxyServer({ autoRewrite: false });
import { validateCookie } from "./utils";
import { currentUser } from "./userManager";

type UserDefinedRoute = {
  route: string;
  allowedRoles?: string[];
  statusCode?: number;
  serve?: string;
};

const serveStatic = (file: string, res: http.ServerResponse) => {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    console.log(">> serving", file);
    res.writeHead(200);
    res.end(data);
  });
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

const routes = readRoutes(process.env.SWA_EMU_APP_LOCATION || "");

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
      const user = currentUser();
      if (!userDefinedRoute.allowedRoles.some((role) => user.userRoles.some((ur) => ur === role))) {
        res.writeHead(401);
        res.end();
        return;
      }
    }

    // Wanting a specific status code but no attached route
    else if (userDefinedRoute.statusCode && !userDefinedRoute.serve) {
      if (userDefinedRoute.statusCode === 404) {
        const file404 = path.resolve(__dirname, "..", "mock-pages", "404.html");
        serveStatic(file404, res);
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
    const target = process.env.SWA_EMU_AUTH_URI || "http://localhost:4242";
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
  else if (req.url.startsWith(`/${process.env.SWA_EMU_API_PREFIX || "api"}`)) {
    const target = process.env.SWA_EMU_API_URI || "http://localhost:7071";
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
      const cookie = req.headers.cookie;

      if (cookie && validateCookie(cookie)) {
        const user = currentUser(cookie);
        const buff = Buffer.from(JSON.stringify(user), "utf-8");
        proxyReq.setHeader("x-ms-client-principal", buff.toString("base64"));
      }
    });
  }

  // detected a proxy pass-through from http-server, so 404 it
  else if (req.url.startsWith("/routes.json")) {
    console.log("proxy>", req.method, req.headers.host + req.url);
    const file404 = path.resolve(__dirname, "404.html");
    serveStatic(file404, res);
  }

  // detected SPA mode
  else if (req.url.startsWith("/?")) {
    console.log("proxy>", req.method, req.headers.host + req.url);
    const fileIndex = path.join(process.env.SWA_EMU_APP_LOCATION, "index.html");
    serveStatic(fileIndex, res);
  }

  // proxy APP request to local APP
  else {
    const target = process.env.SWA_EMU_APP_URI || "http://localhost:4200";
    console.log("app>", req.method, target + req.url);

    proxyApp.web(req, res, {
      target,
      secure: false,
    });

    proxyApp.on("error", function (err, req, res) {
      console.log("app>>", req.method, target + req.url);
      res.writeHead(500, {
        "Content-Type": "text/plain",
      });

      res.end(err.toString());
    });
  }
});

const port = parseInt(process.env.SWA_EMU_PORT || "", 10) || 80;
const host = process.env.SWA_EMU_HOST || "0.0.0.0";
const address = `${host}:${port}`;
console.log(`>> SWA listening on ${address}`);
server.listen(port, host);
