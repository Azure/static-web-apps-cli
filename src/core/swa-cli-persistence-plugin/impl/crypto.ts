import crypto from "crypto";
import { logger } from "../../utils";

interface Encryption {
  encrypt(key: string, value: string): Promise<string>;
  decrypt(key: string, data: string): Promise<string>;
}

export class CryptoService {
  private static readonly IV_LENGTH = 16; // For AES, this is always 16
  private static readonly ALGORITHM = "aes-256-cbc";

  private encryption!: Promise<Encryption>;
  constructor(private machineId: string) {
    logger.silly(`Invoking crypto service`);
  }

  private getEncryption(): Promise<Encryption> {
    if (!this.encryption) {
      this.encryption = Promise.resolve({
        encrypt: (machineId: string, value: string): Promise<string> => {
          return new Promise((resolve, reject) => {
            try {
              const iv = crypto.randomBytes(CryptoService.IV_LENGTH);
              let cipher = crypto.createCipheriv(CryptoService.ALGORITHM, Buffer.from(machineId), iv);
              let encrypted = cipher.update(value);
              encrypted = Buffer.concat([encrypted, cipher.final()]);
              const encryptedValue = iv.toString("hex") + ":" + encrypted.toString("hex");
              resolve(encryptedValue);
            } catch (error) {
              reject(error);
            }
          });
        },
        decrypt: (machineId: string, data: string): Promise<string> => {
          return new Promise((resolve, reject) => {
            try {
              let dataSegments: string[] = data.includes(":") ? data.split(":") : [];
              let iv = Buffer.from(dataSegments.shift() || "", "hex");
              let encryptedText = Buffer.from(dataSegments.join(":"), "hex");
              let decipher = crypto.createDecipheriv(CryptoService.ALGORITHM, Buffer.from(machineId), iv);
              let decrypted = decipher.update(encryptedText);
              decrypted = Buffer.concat([decrypted, decipher.final()]);
              resolve(decrypted.toString());
            } catch (error) {
              reject(error);
            }
          });
        },
      });
    }
    return this.encryption;
  }

  async encrypt(value: string): Promise<string> {
    logger.silly(`Encrypting credentials`);

    try {
      const encryption = await this.getEncryption();
      return encryption.encrypt(this.machineId, value);
    } catch (error) {
      logger.warn(`Failed to encrypt credentials: ${(error as any).message}`);
      return value;
    }
  }

  async decrypt(value: string): Promise<string> {
    logger.silly(`Decrypting credentials`);

    try {
      const encryption = await this.getEncryption();
      return encryption.decrypt(this.machineId, value);
    } catch (error) {
      logger.warn(`Failed to decrypt credentials: ${(error as any).message}`);
      return value;
    }
  }
}
