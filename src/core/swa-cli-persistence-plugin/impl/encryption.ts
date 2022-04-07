import crypto from "crypto";

interface Encryption {
  encrypt(key: string, value: string): Promise<string>;
  decrypt(key: string, data: string): Promise<string>;
}

export class EncryptionService {
  constructor(private machineId: string) {}

  private getEncryption(): Promise<Encryption> {
    return Promise.resolve({
      encrypt: (machineId: string, value: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          try {
            const iv = crypto.randomBytes(16);
            let cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(machineId), iv);
            let encrypted = cipher.update(value);
            encrypted = Buffer.concat([encrypted, cipher.final()]);

            resolve(iv.toString("hex") + encrypted.toString("hex"));
          } catch (error) {
            reject(error);
          }
        });
      },
      decrypt: (machineId: string, data: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          try {
            let iv = Buffer.from(data.substring(0, 16), "hex");
            let encryptedText = Buffer.from(data.substring(16), "hex");
            let decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(machineId), iv);
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

  async encrypt(value: string): Promise<string> {
    const encryption = await this.getEncryption();
    try {
      return encryption.encrypt(this.machineId, value);
    } catch (e) {
      return value;
    }
  }

  async decrypt(value: string): Promise<string> {
    try {
      const encryption = await this.getEncryption();
      return encryption.decrypt(this.machineId, value);
    } catch (e) {
      return value;
    }
  }
}
