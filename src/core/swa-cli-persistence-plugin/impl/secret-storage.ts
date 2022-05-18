import { TokenCachePersistenceOptions } from "@azure/identity";
import { logger } from "../../utils";
import { NativeCredentialsStore } from "./credentials-store";
import { CryptoService } from "./crypto";

export class SecretStorage {
  private secretStoragePrefix: Promise<string>;

  constructor(
    private options: TokenCachePersistenceOptions,
    private readonly credentialsService: NativeCredentialsStore,
    private readonly encryptionService: CryptoService
  ) {
    this.secretStoragePrefix = this.credentialsService.getSecretStoragePrefix();
  }

  private async getFullKey(machineId: string): Promise<string> {
    return `${await this.secretStoragePrefix}-${machineId}`;
  }

  async getCredentials(machineId: string, key: string): Promise<string | undefined> {
    logger.silly(`Getting credentials`);

    const fullKey = await this.getFullKey(machineId);

    let credentials = await this.credentialsService.getPassword(fullKey, key);
    logger.silly(`Credentials: ${credentials ? "<hidden>" : "<empty>"}`);

    if (this.options.unsafeAllowUnencryptedStorage === false) {
      credentials = credentials && (await this.encryptionService.decrypt(credentials));
      logger.silly(`Decrypted credentials: ${credentials ? "<hidden>" : "<empty>"}`);
    }

    if (credentials) {
      try {
        const value = JSON.parse(credentials);
        logger.silly(`Credentials content: ${value.content ? "<hidden>" : "<empty>"}`);

        if (value.machineId === machineId) {
          return value.content;
        }
      } catch (error: any) {
        logger.silly(`Error while trying to parse credentials: ${error.message}`);
        // Delete corrupted credentials or else we're stuck with them forever
        await this.deleteCredentials(machineId, key);
        throw new Error("Cannot load credentials, please try again.");
      }
    }

    return undefined;
  }

  async setCredentials(machineId: string, key: string, value: string): Promise<void> {
    logger.silly(`Setting credentials in keychain`);

    const fullKey = await this.getFullKey(machineId);

    let credentials = JSON.stringify({
      machineId,
      content: value,
    });

    if (this.options.unsafeAllowUnencryptedStorage === false) {
      credentials = await this.encryptionService.encrypt(credentials);
      logger.silly(`Encrypted credentials: ${credentials ? "<hidden>" : "<empty>"}`);
    }

    return this.credentialsService.setPassword(fullKey, key, credentials);
  }

  async deleteCredentials(machineId: string, key: string): Promise<void> {
    logger.silly(`deleting credentials from keychain`);

    try {
      const fullKey = await this.getFullKey(machineId);
      logger.silly({ fullKey });

      await this.credentialsService.deletePassword(fullKey, key);
      logger.silly(`Credentials deleted`);
    } catch (_) {
      throw new Error("Cannot delete credentials");
    }
  }
}
