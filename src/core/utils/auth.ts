import crypto from "crypto";

export function newGuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function hashStateGuid(guid: string) {
  const hash = crypto.createHmac("sha256", process.env.SALT || "");
  hash.update(guid);
  return hash.digest("hex");
}

export function newNonceWithExpiration() {
  const nonceExpiration = Date.now() + 1000 * 60;
  return `${newGuid()}_${nonceExpiration}}`;
}

export function isNonceExpired(nonce: string) {
  if (!nonce) {
    return true;
  }

  const expirationString = nonce.split("_")[1];

  if (!expirationString) {
    return true;
  }

  const expirationParsed = parseInt(expirationString, 10);

  if (isNaN(expirationParsed) || expirationParsed < Date.now()) {
    return true;
  }

  return false;
}

export function extractPostLoginRedirectUri(protocol?: string, host?: string, path?: string) {
  if (!!protocol && !!host && !!path) {
    try {
      const url = new URL(`${protocol}://${host}${path}`);
      return url.searchParams.get("post_login_redirect_uri") ?? undefined;
    } catch {}
  }

  return undefined;
}

const IV_LENGTH = 16; // For AES, this is always 16
const CIPHER_ALGORITHM = "aes-256-cbc";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(16).toString("hex");

const SIGNING_KEY = process.env.SIGNING_KEY || crypto.randomBytes(16).toString("hex");
const bitLength = SIGNING_KEY.length * 8;
const HMAC_ALGORITHM = bitLength <= 256 ? "sha256" : bitLength <= 384 ? "sha384" : "sha512";

export function encryptAndSign(value: string): string | undefined {
  try {
    // encrypt
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(value);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const encryptedValue = iv.toString("hex") + ":" + encrypted.toString("hex");

    // sign
    const hash = crypto.createHmac(HMAC_ALGORITHM, process.env.SALT || "");
    hash.update(encryptedValue);
    const signature = hash.digest("hex");

    const signedEncryptedValue = signature + ":" + encryptedValue;
    return signedEncryptedValue;
  } catch {
    return undefined;
  }
}

export function validateSignatureAndDecrypt(data: string): string | undefined {
  try {
    const dataSegments: string[] = data.includes(":") ? data.split(":") : [];

    if (dataSegments.length < 3) {
      return undefined;
    }

    // validate signature
    const signature = dataSegments.shift() || "";
    const signedData = dataSegments.join(":");

    const hash = crypto.createHmac(HMAC_ALGORITHM, process.env.SALT || "");
    hash.update(signedData);
    const testSignature = hash.digest("hex");

    if (signature !== testSignature) {
      return undefined;
    }

    // decrypt
    const iv = Buffer.from(dataSegments.shift() || "", "hex");
    const encryptedText = Buffer.from(dataSegments.join(":"), "hex");
    const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return undefined;
  }
}

export function isValueEncryptedAndSigned(value: string) {
  const segments = value.split(":");
  return segments.length === 3 && segments[0].length === 64 && segments[1].length >= 32;
}
