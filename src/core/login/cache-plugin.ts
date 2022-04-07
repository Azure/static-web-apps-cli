import { ICachePlugin, TokenCacheContext } from "@azure/msal-node";
import { logger } from "../utils";

const beforeCacheAccess = async (_cacheContext: TokenCacheContext): Promise<void> => {
  logger.warn(`Not implemented: beforeCacheAccess`);
};

const afterCacheAccess = async (_cacheContext: TokenCacheContext): Promise<void> => {
  logger.warn(`Not implemented: afterCacheAccess`);
};

export const cachePlugin: ICachePlugin = {
  beforeCacheAccess,
  afterCacheAccess,
};
