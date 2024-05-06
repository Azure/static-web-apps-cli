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
