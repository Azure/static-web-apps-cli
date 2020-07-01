const http = require("http");
const httpProxy = require("http-proxy");
const proxyApp = httpProxy.createProxyServer({ autoRewrite: true });
const proxyApi = httpProxy.createProxyServer({ autoRewrite: true });
const proxyAuth = httpProxy.createProxyServer({ autoRewrite: false });

var server = http.createServer(function (req, res) {
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
  } else if (req.url.startsWith(`/${process.env.SWA_EMU_API_PREFIX || "api"}`)) {
    const target = process.env.SWA_EMU_API_URI || "http://localhost:7170";
    console.log("api>", req.method, target + req.url);

    proxyApi.web(req, res, {
      target,
    });
    proxyApi.on("error", function (err, req, res) {
      console.log("api>>", req.method, target + req.url);
      console.log(err.message);
      proxyApi.close();
    });
  } else {
    const target = process.env.SWA_EMU_APP_URI || "http://localhost:4200";
    console.log("app>", req.method, target + req.url);

    proxyApp.web(req, res, {
      target,
    });
    proxyApp.on("error", function (err, req, res) {
      console.log("app>>", req.method, target + req.url);
      proxyApp.close();
    });
  }
});

const address = `${process.env.SWA_EMU_HOST || "0.0.0.0"}:${process.env.SWA_EMU_PORT || 80}`;
console.log(`>> SWA listening on ${address}`);
server.listen(process.env.SWA_EMU_PORT || 80, process.env.SWA_EMU_HOST || "0.0.0.0");
