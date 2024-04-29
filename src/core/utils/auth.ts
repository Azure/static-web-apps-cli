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
