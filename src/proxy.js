const fs = require("fs");
const path = require("path");
const http = require("http");
const httpProxy = require("http-proxy");
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyAuth = httpProxy.createProxyServer({ autoRewrite: false });

const serveStatic = (file, res) => {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
};

var server = http.createServer(function (req, res) {
  // proxy AUTH request to AUTH emulator
  if (req.url.startsWith("/.auth")) {
    const target = process.env.SWA_EMU_AUTH_URI || "http://localhost:4242";
    req.url = `/app${req.url}`;

    console.log("auth>", req.method, target + req.url);
    proxyAuth.web(req, res, {
      target,
    });
    proxyAuth.on("proxyRes", function (proxyRes, req, res) {
      console.log("auth>>", req.method, target + req.url);
      console.log(JSON.stringify(proxyRes.headers, true, 2));
    });
    proxyAuth.on("error", function (err, req, res) {
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
    proxyApi.on("error", function (err, req, res) {
      console.log("api>>", req.method, target + req.url);
      console.log(err.message);
      proxyApi.close();
    });
  }

  // proxy APP request to local APP
  else {
    const target = process.env.SWA_EMU_APP_URI || "http://localhost:4200";
    console.log("app>", req.method, target + req.url);

    proxyApp.web(req, res, {
      target,
      // set this to true so we can handle our own response
      // see https://github.com/http-party/node-http-proxy#miscellaneous
      selfHandleResponse: true,
    });

    proxyApp.on("proxyRes", function (proxyRes, req, res) {
      const file404 = path.resolve(__dirname, "404.html");
      if (proxyRes.statusCode === 404) {
        serveStatic(file404, res);
      } else {
        let file = path.join(process.env.SWA_EMU_APP_LOCATION, req.url);
        if (fs.existsSync(file)) {
          if (fs.lstatSync(file).isDirectory()) {
            file = `${file}index.html`;
          }
          serveStatic(file, res);
        } else {
          // URL/file not found on disk
          serveStatic(file404, res);
        }
      }
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

const address = `${process.env.SWA_EMU_HOST || "0.0.0.0"}:${process.env.SWA_EMU_PORT || 80}`;
console.log(`>> SWA listening on ${address}`);
server.listen(process.env.SWA_EMU_PORT || 80, process.env.SWA_EMU_HOST || "0.0.0.0");
