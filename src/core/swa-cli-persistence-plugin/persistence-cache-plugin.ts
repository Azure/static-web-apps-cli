import { Environment } from "@azure/ms-rest-azure-env";
import { ICachePlugin, TokenCacheContext } from "@azure/msal-common";
import { logger } from "../utils";
import { CredentialsStore } from "./impl/credentials-store";
import { EncryptionService } from "./impl/encryption";
import { getMachineId } from "./impl/machine-identifier";
import { SecretStorage } from "./impl/secret-storage";

export interface SWACLIPersistenceCacheOptions {
  enableCache: boolean;
}

/**
 * SWA CLI cache plugin which enables callers to write the MSAL cache to disk on Windows,
 * macOs, and Linux using Keytar.
 */
export class SWACLIPersistenceCachePlugin implements ICachePlugin {
  constructor(private options: SWACLIPersistenceCacheOptions) {}

  /**
   * Reads from storage and saves an in-memory copy. If persistence has not been updated
   * since last time data was read, in memory copy is used.
   *
   * If cacheContext.cacheHasChanged === true, then file lock is created and not deleted until
   * afterCacheAccess() is called, to prevent the cache file from changing in between
   * beforeCacheAccess() and afterCacheAccess().
   */
  public async beforeCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    logger.silly(`beforeCacheAccess called`);

    const machineId = await getMachineId();
    logger.silly(`machineId: ${machineId}`);

    const secretStorage = new SecretStorage(new CredentialsStore(this.options.enableCache), new EncryptionService(machineId));

    const cachedValue: string | undefined = await secretStorage.getSecret(machineId, Environment.AzureCloud.name);
    logger.silly(`cachedValue: ${cachedValue ? "<hidden>" : "<empty>"}`);

    cachedValue && cacheContext.tokenCache.deserialize(cachedValue);
  }

  /**
   * Writes to storage if MSAL in memory copy of cache has been changed.
   */
  public async afterCacheAccess(cacheContext: TokenCacheContext): Promise<void> {
    logger.silly(`afterCacheAccess called`);

    const machineId = await getMachineId();
    logger.silly(`machineId: ${machineId}`);

    const secretStorage = new SecretStorage(new CredentialsStore(false), new EncryptionService(machineId));

    logger.silly(`cacheContext.cacheHasChanged: ${cacheContext.cacheHasChanged}`);

    if (cacheContext.cacheHasChanged) {
      await secretStorage.storeSecret(machineId, Environment.AzureCloud.name, cacheContext.tokenCache.serialize());
    }
  }
}
