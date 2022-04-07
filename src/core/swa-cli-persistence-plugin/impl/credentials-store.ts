import { logger } from "../../utils";

type KeytarModule = typeof import("keytar");
interface ChunkedPassword {
  content: string;
  hasNextChunk: boolean;
}

interface ICredentialsStore {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
  findPassword(service: string): Promise<string | null>;
  findCredentials(service: string): Promise<Array<{ account: string; password: string }>>;
  clear(): Promise<void>;
}

export class CredentialsStore implements ICredentialsStore {
  constructor(private disableKeytar: boolean) {}

  private static readonly MAX_PASSWORD_LENGTH = 2500;
  private static readonly PASSWORD_CHUNK_SIZE = CredentialsStore.MAX_PASSWORD_LENGTH - 100;

  protected _keytarCache: KeytarModule | undefined;

  async getPassword(service: string, account: string): Promise<string | null> {
    const keytar = await this.withKeytar();
    logger.silly("Getting password from keytar");

    const password = await keytar.getPassword(service, account);
    logger.silly("Got password from keytar: " + (password ? "<hidden>" : "<empty>"));

    if (password) {
      logger.silly("Password found in keytar");

      try {
        let { content, hasNextChunk }: ChunkedPassword = JSON.parse(password);

        if (!content || !hasNextChunk) {
          return password;
        }

        logger.silly("Password is chunked. Reading all chunks...");

        let index = 1;
        while (hasNextChunk) {
          const nextChunk = await keytar.getPassword(service, `${account}-${index}`);
          const result: ChunkedPassword = JSON.parse(nextChunk!);
          content += result.content;
          hasNextChunk = result.hasNextChunk;
          index++;
        }

        logger.silly("Got all chunks successfully");
        return content;
      } catch {
        logger.silly("Password is not chunked");
        logger.silly("Returning password as is");
        return password;
      }
    }

    logger.silly("Password not found in keytar");
    return password;
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    logger.silly("Setting password in keytar");

    const keytar = await this.withKeytar();
    logger.silly("Got keytar");

    const MAX_SET_ATTEMPTS = 3;

    // Sometimes Keytar has a problem talking to the keychain on the OS. To be more resilient, we retry a few times.
    const setPasswordWithRetry = async (service: string, account: string, password: string) => {
      logger.silly("set password with retry...");

      let attempts = 0;
      let error: any;
      while (attempts < MAX_SET_ATTEMPTS) {
        try {
          logger.silly("Attempting to set password");

          await keytar.setPassword(service, account, password);

          logger.silly("Set password successfully");

          return;
        } catch (e) {
          error = e;
          logger.warn("Error attempting to set a password. Trying again... (" + attempts + ")");
          logger.warn(error as any);
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // throw last error
      throw error;
    };

    if (password.length > CredentialsStore.MAX_PASSWORD_LENGTH) {
      logger.silly("Password is too long. Chunking it.");

      let index = 0;
      let chunk = 0;
      let hasNextChunk = true;
      while (hasNextChunk) {
        const passwordChunk = password.substring(index, index + CredentialsStore.PASSWORD_CHUNK_SIZE);
        index += CredentialsStore.PASSWORD_CHUNK_SIZE;
        hasNextChunk = password.length - index > 0;

        const content: ChunkedPassword = {
          content: passwordChunk,
          hasNextChunk: hasNextChunk,
        };

        await setPasswordWithRetry(service, chunk ? `${account}-${chunk}` : account, JSON.stringify(content));
        chunk++;
      }
    } else {
      await setPasswordWithRetry(service, account, password);
    }

    // TODO: emit password change event
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    logger.silly("Deleting password from keytar");

    const keytar = await this.withKeytar();
    logger.silly("Got keytar");

    const didDelete = await keytar.deletePassword(service, account);
    logger.silly("Deleted password from keytar: " + didDelete);

    if (didDelete) {
      // TODO: emit password change event
    }

    return didDelete;
  }

  async findPassword(service: string): Promise<string | null> {
    logger.silly("findPassword called");

    const keytar = await this.withKeytar();
    logger.silly("Got keytar");

    const password = await keytar.findPassword(service);
    logger.silly("Got password from keytar: " + (password ? "<hidden>" : "<empty>"));

    return password;
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    const keytar = await this.withKeytar();

    return keytar.findCredentials(service);
  }

  public clear(): Promise<void> {
    logger.silly("clear called");

    if (this._keytarCache instanceof InMemoryCredentialsStore) {
      logger.silly("Clearing in-memory credentials");

      return this._keytarCache.clear();
    }

    // We don't know how to properly clear Keytar because we don't know
    // what services have stored credentials. For reference, a "service" is an extension.
    // TODO: should we clear credentials for the built-in auth extensions?
    return Promise.resolve();
  }

  public async getSecretStoragePrefix() {
    return Promise.resolve("swa-cli");
  }

  async withKeytar(): Promise<KeytarModule> {
    logger.silly("Getting keytar");
    logger.silly(`disableKeytar: ${this.disableKeytar}`);
    logger.silly(`keytarCache: ${this._keytarCache}`);

    if (this._keytarCache) {
      return this._keytarCache;
    }

    if (this.disableKeytar) {
      logger.silly("Keytar is disabled. Using in-memory credential store instead.");
      this._keytarCache = new InMemoryCredentialsStore();
      return this._keytarCache;
    }

    try {
      logger.silly("Attempting to load keytar");
      this._keytarCache = await import("keytar");

      // Try using keytar to see if it throws or not.
      await this._keytarCache.findCredentials("test-keytar-loads");
    } catch (e) {
      throw e;
    }

    logger.silly("Got keytar");
    return this._keytarCache;
  }
}

class InMemoryCredentialsStore implements ICredentialsStore {
  private secretVault: any = {};

  async getPassword(service: string, account: string): Promise<string | null> {
    return this.secretVault[service]?.[account] ?? null;
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    this.secretVault[service] = this.secretVault[service] ?? {};
    this.secretVault[service]![account] = password;
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    if (!this.secretVault[service]?.[account]) {
      return false;
    }
    delete this.secretVault[service]![account];
    if (Object.keys(this.secretVault[service]!).length === 0) {
      delete this.secretVault[service];
    }
    return true;
  }

  async findPassword(service: string): Promise<string | null> {
    return JSON.stringify(this.secretVault[service]) ?? null;
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    const credentials: { account: string; password: string }[] = [];
    for (const account of Object.keys(this.secretVault[service] || {})) {
      credentials.push({ account, password: this.secretVault[service]![account] });
    }
    return credentials;
  }

  async clear(): Promise<void> {
    this.secretVault = {};
  }
}
