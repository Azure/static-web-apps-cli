import http from "http";
import { logger } from "../../../core";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration
export const mimeTypes = async (req: http.IncomingMessage, res: http.ServerResponse, mimeTypes: SWAConfigFileMimeTypes) => {
  if (req.url?.includes(".")) {
    logger.silly(`checking mimeTypes rule...`);

    const fileExtentionFromURL = req.url?.split(".").pop();
    const overrideMimeType = mimeTypes?.[`.${fileExtentionFromURL}`];

    if (fileExtentionFromURL && overrideMimeType) {
      res.setHeader("Content-Type", overrideMimeType);
    }
  }
};
