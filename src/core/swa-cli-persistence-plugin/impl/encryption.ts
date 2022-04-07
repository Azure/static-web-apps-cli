export interface Encryption {
  encrypt(key: string, value: string): Promise<string>;
  decrypt(key: string, value: string): Promise<string>;
}

export class EncryptionService {
  constructor(private machineId: string) {}

  // TODO: implement encryption logic
  private encryption(): Promise<Encryption> {
    return Promise.resolve({} as Encryption);
  }

  async encrypt(value: string): Promise<string> {
    try {
      const encryption = await this.encryption();
      return encryption.encrypt(this.machineId, value);
    } catch (e) {
      return value;
    }
  }

  async decrypt(value: string): Promise<string> {
    try {
      const encryption = await this.encryption();
      return encryption.decrypt(this.machineId, value);
    } catch (e) {
      return value;
    }
  }
}
