import { logger } from "../../utils";
import { CredentialsStore } from "./credentials-store";
import { EncryptionService } from "./encryption";

export class SecretStorage {
  private secretStoragePrefix: Promise<string>;

  constructor(private readonly credentialsService: CredentialsStore, private readonly encryptionService: EncryptionService) {
    this.secretStoragePrefix = this.credentialsService.getSecretStoragePrefix();
  }

  private async getFullKey(machineId: string): Promise<string> {
    return `${await this.secretStoragePrefix}-${machineId}`;
  }

  async getSecret(machineId: string, key: string): Promise<string | undefined> {
    logger.silly(`getPassword called`);

    const fullKey = await this.getFullKey(machineId);
    logger.silly(`fullKey: ${fullKey}`);

    const password = await this.credentialsService.getPassword(fullKey, key);
    logger.silly(`password: ${password ? "<hidden>" : "<empty>"}`);

    const decrypted = password && (await this.encryptionService.decrypt(password));
    logger.silly(`decrypted: ${decrypted ? "<hidden>" : "<empty>"}`);

    if (decrypted) {
      try {
        const value = JSON.parse(decrypted);
        logger.silly(`value: ${value.content ? "<hidden>" : "<empty>"}`);

        if (value.machineId === machineId) {
          return value.content;
        }
      } catch (_) {
        throw new Error("Cannot get password");
      }
    }

    return undefined;
  }

  async storeSecret(machineId: string, key: string, value: string): Promise<void> {
    logger.silly(`setPassword called`);

    const fullKey = await this.getFullKey(machineId);
    logger.silly(`fullKey: ${fullKey}`);

    const toEncrypt = JSON.stringify({
      machineId,
      content: value,
    });

    const encrypted = await this.encryptionService.encrypt(toEncrypt);
    logger.silly(`encrypted: ${encrypted ? "<hidden>" : "<empty>"}`);

    return this.credentialsService.setPassword(fullKey, key, encrypted);
  }

  async deleteSecret(machineId: string, key: string): Promise<void> {
    logger.silly(`deletePassword called`);

    try {
      const fullKey = await this.getFullKey(machineId);
      logger.silly(`fullKey: ${fullKey}`);

      await this.credentialsService.deletePassword(fullKey, key);
      logger.silly(`Password deleted`);
    } catch (_) {
      throw new Error("Cannot delete password");
    }
  }
}
