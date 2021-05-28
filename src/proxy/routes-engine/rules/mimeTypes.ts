import chalk from "chalk";
import type http from "http";
import path from "path";
import { logger } from "../../../core";
import { DEFAULT_MIME_TYPE, MIME_TYPE_LIST } from "../../../core/utils/constants";

// See: https://docs.microsoft.com/en-us/azure/static-web-apps/configuration
export async function mimeTypes(req: http.IncomingMessage, res: http.ServerResponse, mimeTypes: SWAConfigFileMimeTypes) {
  if (req.url?.includes(".")) {
    logger.silly(`checking mimeTypes rule...`);

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

  logger.silly(`checking mime types (extension: ${chalk.yellow(extension || null)})...`);
  let mimeType = DEFAULT_MIME_TYPE;

  if (customMimeType) {
    mimeType = customMimeType[extension];
  } else if (extension && MIME_TYPE_LIST[extension]) {
    mimeType = MIME_TYPE_LIST[extension];
  }

  logger.silly(` - found: ${chalk.yellow(mimeType)}`);
  return mimeType;
}
