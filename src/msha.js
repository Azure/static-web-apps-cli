const http = require("http");
const httpProxy = require("http-proxy");
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyAuth = httpProxy.createProxyServer({ autoRewrite: true });

var server = http.createServer(function (req, res) {
  if (req.url.startsWith("/.auth") || req.url.startsWith("/.redirect")) {
    const target = process.env.SWA_EMU_AUTH_URI || "http://localhost:4242";
    console.log("auth>", req.method, target + req.url);

    req.url = req.url.startsWith("/.auth") ? `app${req.url}` : req.url;
    proxyAuth.web(req, res, {
      target,
    });
    proxyAuth.on("error", function (err, req, res) {
      console.log("auth>", err.message);
      proxyAuth.close();
    });
  } else if (req.url.startsWith(`/${process.env.SWA_EMU_API_PREFIX || "api"}`)) {
    const target = process.env.SWA_EMU_API_URI || "http://localhost:7170";
    console.log("api>", req.method, target + req.url);

    proxyApi.web(req, res, {
      target,
    });
    proxyApi.on("error", function (err, req, res) {
      console.log("api>", err.message);
      proxyApi.close();
    });
  } else {
    const target = process.env.SWA_EMU_API_URI || "http://localhost:4200";
    console.log("app>", req.method, target + req.url);

    proxyApp.web(req, res, {
      target,
    });
    proxyApp.on("error", function (err, req, res) {
      console.log("app>", err.message);
      proxyApp.close();
    });
  }
});

const address = `${process.env.SWA_EMU_HOST || "0.0.0.0"}:${process.env.SWA_EMU_PORT || 80}`;
console.log(`>> SWA listening on ${address}`);
server.listen(process.env.SWA_EMU_PORT || 80, process.env.SWA_EMU_HOST || "0.0.0.0");
