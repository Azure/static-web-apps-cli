import http from "http";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#response-overrides
export const responseOverrides = async (req: http.IncomingMessage, res: http.ServerResponse, responseOverrides: SWAConfigFileResponseOverrides) => {
  const statusCode = res.statusCode;

  if ([400, 401, 403, 404].includes(statusCode)) {
    const overridenStatusCode = responseOverrides?.[`${statusCode}`];

    if (overridenStatusCode) {
      if (overridenStatusCode.statusCode) {
        res.statusCode = overridenStatusCode.statusCode;
      }
      if (overridenStatusCode.redirect) {
        res.setHeader("Location", overridenStatusCode.redirect);
      }
      if (overridenStatusCode.rewrite && req.url !== overridenStatusCode.rewrite) {
        req.url = overridenStatusCode.rewrite;
      }
    }
  }
};
