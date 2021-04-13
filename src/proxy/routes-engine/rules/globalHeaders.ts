import type http from "http";
import { logger } from "../../../core";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#global-headers
export const globalHeaders = async (_req: http.IncomingMessage, res: http.ServerResponse, globalHeaders: SWAConfigFileGlobalHeaders) => {
  logger.silly("checking globalHeaders rule...");

  for (const header in globalHeaders) {
    if (globalHeaders[header] === "") {
      res.removeHeader(header);

      logger.silly(` - removing header: ${header}`);
    } else {
      res.setHeader(header, globalHeaders[header]);

      logger.silly(` - adding header: ${header}=${globalHeaders[header]}`);
    }
  }
};
