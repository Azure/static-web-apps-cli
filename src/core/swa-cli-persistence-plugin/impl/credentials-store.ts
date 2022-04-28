import { TokenCachePersistenceOptions } from "@azure/identity";
import os from "os";
import waitOn from "wait-on";
import { isValidIpAddress, isWSL, logger } from "../../utils";

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

export class NativeCredentialsStore implements KeychainCredentialsStore {
  constructor(private options: TokenCachePersistenceOptions) {}

  private static readonly KEYCHAIN_ENTRY_MAX_LENGTH = 2500;
  private static readonly KEYCHAIN_ENTRY_CHUNK_SIZE = NativeCredentialsStore.KEYCHAIN_ENTRY_MAX_LENGTH - 100;
  private static readonly KEYCHAIN_SERVICE = "swa-cli";

  private keychainCache: KeychainModule | undefined | any;

  async getPassword(service: string, account: string): Promise<string | null> {
    logger.silly("Getting credentials from native keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got native keychain reference");

    const credentials = await keychain.getPassword(service, account);
    logger.silly("Got credentials from native keychain: " + (credentials ? "<hidden>" : "<empty>"));

    if (credentials) {
      logger.silly("Credentials found in native keychain");

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

    logger.silly("Credentials not found in native keychain");
    return credentials;
  }

  async setPassword(service: string, account: string, credentials: string): Promise<void> {
    logger.silly("Setting credentials in native keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got native keychain reference");

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

    if (credentials.length > NativeCredentialsStore.KEYCHAIN_ENTRY_MAX_LENGTH) {
      logger.silly("Credentials value is too long. Chunking it.");

      let index = 0;
      let chunk = 0;
      let hasNextChunk = true;
      while (hasNextChunk) {
        const credentialsChunk = credentials.substring(index, index + NativeCredentialsStore.KEYCHAIN_ENTRY_CHUNK_SIZE);
        index += NativeCredentialsStore.KEYCHAIN_ENTRY_CHUNK_SIZE;
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
    logger.silly("Deleting credentials from native keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got native keychain reference");

    const didDelete = await keychain.deletePassword(service, account);
    logger.silly("Deleted credentials from native keychain: " + didDelete);

    return didDelete;
  }

  async findPassword(service: string): Promise<string | null> {
    logger.silly("Finding password in native keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got native keychain reference");

    const credentials = await keychain.findPassword(service);
    logger.silly("Got credentials from native keychain: " + (credentials ? "<hidden>" : "<empty>"));

    return credentials;
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    logger.silly("Finding credentials in native keychain");

    const keychain = await this.requireKeychain();
    logger.silly("Got native keychain reference");

    const credentials = await keychain.findCredentials(service);
    logger.silly("Got credentials from native keychain: " + (credentials ? "<hidden>" : "<empty>"));

    return credentials;
  }

  public clear(): Promise<void> {
    logger.silly("Clear native keychain");

    if (this.keychainCache instanceof InMemoryCredentialsStore) {
      logger.silly("Clearing credentials from in-memory keychain");

      return this.keychainCache.clear();
    }

    // We don't know how to properly clear Keytar because we don't know
    // what services have stored credentials. For reference, a "service" is an extension.
    // TODO: should we clear credentials for the built-in auth extensions?
    return Promise.resolve();
  }

  public async getSecretStoragePrefix() {
    return Promise.resolve(NativeCredentialsStore.KEYCHAIN_SERVICE);
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
      logger.silly("Attempting to load native keychain");

      await this.validateX11Environment();
      this.keychainCache = await import("keytar");

      // Try using keytar to see if it throws or not.
      await this.keychainCache.findCredentials("Out of the mountain of despair, a stone of hope");
    } catch (error) {
      throw error;
    }

    logger.silly("Got native keychain reference");
    return this.keychainCache;
  }
  async validateX11Environment() {
    if (!isWSL()) {
      // we assume that if we're not on WSL, we're on a sane environment
      // that has a valid X11 environment.
      return;
    }

    const { DISPLAY, WAYLAND_DISPLAY, MIR_SOCKET, WAYLAND_SOCKET } = process.env;
    let x11Host = DISPLAY || WAYLAND_DISPLAY || MIR_SOCKET || WAYLAND_SOCKET;

    const printX11ErrorAndExit = () =>
      logger.error(
        `An X11 server is required when keychain is enabled. You can disable keychain using --no-use-keychain or try a different login method.`,
        true
      );

    if (!x11Host) {
      logger.error(`Environment variable DISPLAY is not set.`);
      printX11ErrorAndExit();
    } else {
      logger.silly("X11 is set: " + x11Host);

      // An X11 address can be one of the following:
      //   - hostname:D.S means screen S on display D of host hostname; the X server for this display is listening at TCP port 6000+D.
      //   - host/unix:D.S means screen S on display D of host host; the X server for this display is listening at UNIX domain socket /tmp/.X11-unix/XD
      //     (so it's only reachable from host).
      //   - :D.S is equivalent to host/unix:D.S, where host is the local hostname.

      let [x11Hostname, x11Display] = x11Host.split(":");

      let x11Port = 6000;
      if (x11Display) {
        let [display, _screen] = x11Display.split(".");
        x11Port += parseInt(display, 10);
      }

      logger.silly("X11 hostname: " + x11Hostname);

      if (isValidIpAddress(x11Hostname)) {
        logger.silly("X11 has a valid IP address");
      } else {
        x11Hostname = os.hostname();
        logger.silly("X11 value is not a valid hostname. Forcing X11 host name to " + x11Hostname);
      }

      logger.silly(`checking if X11 host ${x11Hostname}:${x11Port} is reachable. This may take a few seconds...`);

      try {
        await waitOn({
          resources: ["tcp:" + x11Hostname + ":" + x11Port],
          delay: 5000, // 5 seconds
          timeout: 10000, // 10 seconds
        });
      } catch (error) {
        logger.error(`X11 host ${x11Hostname}:${x11Port} is not reachable.`);
        printX11ErrorAndExit();
      }
    }
  }
}

class InMemoryCredentialsStore implements KeychainCredentialsStore {
  private secretVault: any = {};

  async getPassword(service: string, account: string): Promise<string | null> {
    logger.silly("Getting password from in-memory keychain");

    return this.secretVault[service]?.[account] ?? null;
  }

  async setPassword(service: string, account: string, credentials: string): Promise<void> {
    logger.silly("Setting password in in-memory keychain");

    this.secretVault[service] = this.secretVault[service] ?? {};
    this.secretVault[service]![account] = credentials;
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    logger.silly("Deleting password from in-memory keychain");

    if (!this.secretVault[service]?.[account]) {
      logger.silly("Password not found in in-memory keychain");
      return false;
    }
    delete this.secretVault[service]![account];

    if (Object.keys(this.secretVault[service]!).length === 0) {
      delete this.secretVault[service];
    }

    logger.silly("Password deleted from in-memory keychain");
    return true;
  }

  async findPassword(service: string): Promise<string | null> {
    logger.silly("Finding password in in-memory keychain");

    return JSON.stringify(this.secretVault[service]) ?? null;
  }

  async findCredentials(service: string): Promise<Array<KeychainCredentialsAccount>> {
    logger.silly("Finding credentials in in-memory keychain");

    const credentials: KeychainCredentialsAccount[] = [];
    for (const account of Object.keys(this.secretVault[service] || {})) {
      credentials.push({ account, password: this.secretVault[service]![account] });
    }

    logger.silly("Got credentials from native keychain: " + (credentials ? "<hidden>" : "<empty>"));
    return credentials;
  }

  async clear(): Promise<void> {
    logger.silly("Clearing in-memory keychain");

    this.secretVault = {};
  }
}
