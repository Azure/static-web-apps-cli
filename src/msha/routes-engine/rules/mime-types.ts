import chalk from "chalk";
import type http from "http";
import path from "path";
import { logger } from "../../../core";
import { DEFAULT_MIME_TYPE, MIME_TYPE_LIST } from "../../../core/constants";

// See: https://docs.microsoft.com/azure/static-web-apps/configuration
export async function mimeTypes(req: http.IncomingMessage, res: http.ServerResponse, mimeTypes: SWAConfigFileMimeTypes) {
  if (req.url?.includes(".")) {
    logger.silly(`checking mimeTypes rule`);

    const fileExtentionFromURL = req.url?.split(".").pop();
    const overrideMimeType = mimeTypes?.[`.${fileExtentionFromURL}`];

    if (fileExtentionFromURL && overrideMimeType) {
      res.setHeader("Content-Type", overrideMimeType);
    }
  }
}

export function getMimeTypeForExtension(filePathFromRequest: string | URL | null, customMimeType?: SWAConfigFileMimeTypes | undefined) {
  if (filePathFromRequest instanceof URL) {
    filePathFromRequest = filePathFromRequest.toString();
  }
  const extension = path.extname(filePathFromRequest!);

  logger.silly(`checking mime types`);
  logger.silly(` - filePathFromRequest: ${chalk.yellow(filePathFromRequest)}`);
  logger.silly(` - extension: ${chalk.yellow(extension || "<empty>")}`);

  let mimeType = MIME_TYPE_LIST[extension] || DEFAULT_MIME_TYPE;

  if (customMimeType?.[extension]) {
    mimeType = customMimeType[extension];
  }

  logger.silly(` - found: ${chalk.yellow(mimeType || "<undefined>")}`);
  return mimeType;
}
