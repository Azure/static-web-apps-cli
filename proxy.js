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
      target: "http://localhost:4242",
    });
  } else if (req.url.startsWith("/api")) {
    console.log("api>", req.method, req.url);

    proxyApi.web(req, res, {
      target: "http://localhost:7170",
    });
  } else {
    console.log("app>", req.method, req.url);

    proxyApp.web(req, res, {
      target: "http://localhost:4200",
    });
  }
});

console.log("listening on port 0.0.0.0:80");
server.listen(80, "0.0.0.0");
