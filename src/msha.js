const http = require("http");
const httpProxy = require("http-proxy");
const proxyApp = httpProxy.createProxyServer({autoRewrite: true});
const proxyApi = httpProxy.createProxyServer({autoRewrite: true});
const proxyAuth = httpProxy.createProxyServer({autoRewrite: true});

var server = http.createServer(function (req, res) {

  if (req.url.startsWith("/.auth")) {
    console.log("auth>", req.method, req.url);

    req.url = `app${req.url}`;

    console.log(req.headers);
    proxyAuth.web(req, res, {
      target: process.env.SWA_EMU_AUTH_URI || "http://localhost:4242",
    });
  } else if (req.url.startsWith(`/${ process.env.SWA_EMU_API_PREFIX || 'api' }`)) {
    console.log("api>", req.method, req.url);

    proxyApi.web(req, res, {
      target: process.env.SWA_EMU_API_URI || "http://localhost:7170",
    });
  } else {
    console.log("app>", req.method, req.url);

    proxyApp.web(req, res, {
      target: process.env.SWA_EMU_APP_URI || "http://localhost:4200",
    });
  }
});

console.log("listening on port 0.0.0.0:80");
server.listen(process.env.SWA_EMU_PORT || 80, process.env.SWA_EMU_HOST || "0.0.0.0");
