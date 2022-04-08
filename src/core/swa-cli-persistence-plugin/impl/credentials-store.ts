import { TokenCachePersistenceOptions } from "@azure/identity";
import { logger } from "../../utils";

type KeychainModule = typeof import("keytar");

interface ChunkedData {
  content: string;
  hasNextChunk: boolean;
}

interface KeychainCredentialsAccount {
  account: string;
  password: string;
}

interface KeychainCredentialsStore {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, credentials: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
  findPassword(service: string): Promise<string | null>;
  findCredentials(service: string): Promise<Array<KeychainCredentialsAccount>>;
  clear(): Promise<void>;
}

export class CredentialsStore implements KeychainCredentialsStore {
  constructor(private options: TokenCachePersistenceOptions) {}

  private static readonly KEYCHAIN_ENTRY_MAX_LENGTH = 2500;
  private static readonly KEYCHAIN_ENTRY_CHUNK_SIZE = CredentialsStore.KEYCHAIN_ENTRY_MAX_LENGTH - 100;
  private static readonly KEYCHAIN_SERVICE = "swa-cli";

  private keychainCache: KeychainModule | undefined;

  async getPassword(service: string, account: string): Promise<string | null> {
    logger.silly("Getting credentials from keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got keychain reference");

    const credentials = await keychain.getPassword(service, account);
    logger.silly("Got credentials from keychain: " + (credentials ? "<hidden>" : "<empty>"));

    if (credentials) {
      logger.silly("Credentials found in keychain");

      try {
        let { content, hasNextChunk }: ChunkedData = JSON.parse(credentials);

        if (!content || !hasNextChunk) {
          return credentials;
        }

        logger.silly("Credentials is chunked. Reading all chunks...");

        let index = 1;
        while (hasNextChunk) {
          const nextChunk = await keychain.getPassword(service, `${account}-${index}`);
          const result: ChunkedData = JSON.parse(nextChunk!);
          content += result.content;
          hasNextChunk = result.hasNextChunk;
          index++;
        }

        logger.silly("Got all chunks successfully");
        return content;
      } catch {
        logger.silly("Credentials is not chunked");
        logger.silly("Returning credentials as is");
        return credentials;
      }
    }

    logger.silly("Credentials not found in keychain");
    return credentials;
  }

  async setPassword(service: string, account: string, credentials: string): Promise<void> {
    logger.silly("Setting credentials in keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got keychain reference");

    const MAX_SET_ATTEMPTS = 3;

    // Sometimes Keytar has a problem talking to the keychain on the OS. To be more resilient, we retry a few times.
    const setPasswordWithRetry = async (service: string, account: string, credentials: string) => {
      let attempts = 0;
      let error: Error | undefined;
      while (attempts < MAX_SET_ATTEMPTS) {
        try {
          logger.silly("Attempting to set credentials");

          await keychain.setPassword(service, account, credentials);

          logger.silly("Set credentials successfully");

          return;
        } catch (error) {
          error = error;
          logger.warn("Error attempting to set a credentials. Trying again... (" + attempts + ")");
          logger.warn(error as any);
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      throw error;
    };

    if (credentials.length > CredentialsStore.KEYCHAIN_ENTRY_MAX_LENGTH) {
      logger.silly("Credentials value is too long. Chunking it.");

      let index = 0;
      let chunk = 0;
      let hasNextChunk = true;
      while (hasNextChunk) {
        const credentialsChunk = credentials.substring(index, index + CredentialsStore.KEYCHAIN_ENTRY_CHUNK_SIZE);
        index += CredentialsStore.KEYCHAIN_ENTRY_CHUNK_SIZE;
        hasNextChunk = credentials.length - index > 0;

        const content: ChunkedData = {
          content: credentialsChunk,
          hasNextChunk: hasNextChunk,
        };

        logger.silly("Setting credentials chunk #" + chunk + " ...");
        await setPasswordWithRetry(service, chunk ? `${account}-${chunk}` : account, JSON.stringify(content));
        chunk++;
      }
    } else {
      await setPasswordWithRetry(service, account, credentials);
    }
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    logger.silly("Deleting credentials from keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got keychain reference");

    const didDelete = await keychain.deletePassword(service, account);
    logger.silly("Deleted credentials from keychain: " + didDelete);

    return didDelete;
  }

  async findPassword(service: string): Promise<string | null> {
    logger.silly("Find password in keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got keychain reference");

    const credentials = await keychain.findPassword(service);
    logger.silly("Got credentials from keychain: " + (credentials ? "<hidden>" : "<empty>"));

    return credentials;
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    const keychain = await this.requireKeychain();
    return keychain.findCredentials(service);
  }

  public clear(): Promise<void> {
    logger.silly("Clear keychain");

    if (this.keychainCache instanceof InMemoryCredentialsStore) {
      logger.silly("Clearing in-memory credentials");

      return this.keychainCache.clear();
    }

    // We don't know how to properly clear Keytar because we don't know
    // what services have stored credentials. For reference, a "service" is an extension.
    // TODO: should we clear credentials for the built-in auth extensions?
    return Promise.resolve();
  }

  public async getSecretStoragePrefix() {
    return Promise.resolve(CredentialsStore.KEYCHAIN_SERVICE);
  }

  async requireKeychain(): Promise<KeychainModule> {
    logger.silly("Getting keychain reference");
    logger.silly(`isKeychainEnabled: ${this.options.enabled}`);
    logger.silly(`KeychainCache: ${this.keychainCache}`);

    if (this.keychainCache) {
      return this.keychainCache;
    }

    if (this.options.enabled === false) {
      logger.silly("keychain is disabled. Using in-memory credential store instead.");
      this.keychainCache = new InMemoryCredentialsStore();
      return this.keychainCache;
    }

    try {
      logger.silly("Attempting to load keychain");
      this.keychainCache = await import("keytar");

      // Try using keytar to see if it throws or not.
      await this.keychainCache.findCredentials("Out of the mountain of despair, a stone of hope");
    } catch (error) {
      throw error;
    }

    logger.silly("Got keychain reference");
    return this.keychainCache;
  }
}

class InMemoryCredentialsStore implements KeychainCredentialsStore {
  private secretVault: any = {};

  async getPassword(service: string, account: string): Promise<string | null> {
    return this.secretVault[service]?.[account] ?? null;
  }

  async setPassword(service: string, account: string, credentials: string): Promise<void> {
    this.secretVault[service] = this.secretVault[service] ?? {};
    this.secretVault[service]![account] = credentials;
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

  async findCredentials(service: string): Promise<Array<KeychainCredentialsAccount>> {
    const credentials: KeychainCredentialsAccount[] = [];
    for (const account of Object.keys(this.secretVault[service] || {})) {
      credentials.push({ account, password: this.secretVault[service]![account] });
    }
    return credentials;
  }

  async clear(): Promise<void> {
    this.secretVault = {};
  }
}
