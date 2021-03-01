import http from "http";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#global-headers
export const globalHeaders = async (_req: http.IncomingMessage, res: http.ServerResponse, globalHeaders: SWAConfigFileGlobalHeaders) => {
  for (const header in globalHeaders) {
    if (globalHeaders[header] === "") {
      res.removeHeader(header);
    } else {
      res.setHeader(header, globalHeaders[header]);
    }
  }
};
