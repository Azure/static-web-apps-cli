import http from "http";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration
export const mimeTypes = async (req: http.IncomingMessage, res: http.ServerResponse, mimeTypes: SWAConfigFileMimeTypes) => {
  if (req.url?.includes(".")) {
    const fileExtentionFromURL = req.url?.split(".").pop();
    const overrideMimeType = mimeTypes[`.${fileExtentionFromURL}`];

    if (fileExtentionFromURL && overrideMimeType) {
      res.setHeader("Content-Type", overrideMimeType);
    }
  }
};
