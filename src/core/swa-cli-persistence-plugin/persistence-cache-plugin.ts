import { TokenCachePersistenceOptions } from "@azure/identity";
import { ICachePlugin, TokenCacheContext } from "@azure/msal-common";
import { logger } from "../utils";
import { Environment } from "./impl/azure-environment";
import { NativeCredentialsStore } from "./impl/credentials-store";
import { CryptoService } from "./impl/crypto";
import { getMachineId } from "./impl/machine-identifier";
import { SecretStorage } from "./impl/secret-storage";

export interface SWACLIPersistenceCacheOptions {
  enableCache: boolean;
  clearCache: boolean;
}

/**
 * SWA CLI cache plugin which enables callers to write the MSAL cache to disk on Windows,
 * macOs, and Linux using native keychain.
 */
export class SWACLIPersistenceCachePlugin implements ICachePlugin {
  constructor(private options: TokenCachePersistenceOptions) {}

  /**
   * Reads from storage and saves an in-memory copy. If keychain has not been updated
   * since last time data was read, in memory copy is used.
   *
   * If cacheContext.cacheHasChanged === true, then file lock is created and not deleted until
   * afterCacheAccess() is called, to prevent the cache file from changing in between
   * beforeCacheAccess() and afterCacheAccess().
   */
  public async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    logger.silly(`Executing before cache access plugin`);

    const machineId = await getMachineId();
    logger.silly(`Machine ID: ${machineId ? "<hidden>" : "<empty>"}`);

    const secretStorage = new SecretStorage(this.options, new NativeCredentialsStore(this.options), new CryptoService(machineId));

    const cachedValue: string | undefined = await secretStorage.getCredentials(machineId, Environment.AzureCloud.name);
    logger.silly(`Credentials: ${cachedValue ? "<hidden>" : "<empty>"}`);

    cachedValue && cacheContext.tokenCache.deserialize(cachedValue);

    logger.silly(`Before cache access plugin. Done.`);
  }

  /**
   * Writes to storage if MSAL in memory copy of cache has been changed.
   */
  public async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    logger.silly(`Executing after cache access plugin`);

    const machineId = await getMachineId();
    logger.silly(`Machine ID: ${machineId ? "<hidden>" : "<empty>"}`);

    const secretStorage = new SecretStorage(this.options, new NativeCredentialsStore(this.options), new CryptoService(machineId));

    logger.silly(`Did TokenCacheContext cache changed: ${cacheContext.cacheHasChanged}`);

    if (cacheContext.cacheHasChanged) {
      await secretStorage.setCredentials(machineId, Environment.AzureCloud.name, cacheContext.tokenCache.serialize());
    }

    logger.silly(`After cache access plugin. Done.`);
  }

  /**
   * Clears credentials cache.
   */
  public async clearCache(): Promise<void> {
    logger.silly(`Clearing credentials cache`);

    const machineId = await getMachineId();
    logger.silly(`Machine ID: ${machineId ? "<hidden>" : "<empty>"}`);

    const secretStorage = new SecretStorage(this.options, new NativeCredentialsStore(this.options), new CryptoService(machineId));

    await secretStorage.deleteCredentials(machineId, Environment.AzureCloud.name);
    logger.silly(`Credentials cache cleared`);
  }
}
