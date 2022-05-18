import crypto from "crypto";
import { networkInterfaces } from "os";
import { logger } from "../../utils";

let machineId: Promise<string>;

/**
 * Generate a 32-byte machine id.
 *
 * @returns {Promise<string>} A 32-byte machine id.
 */
export async function getMachineId(): Promise<string> {
  if (!machineId) {
    machineId = (async () => {
      return (await getMacMachineId()) || crypto.randomBytes(20).toString("hex");
    })();
  }
  return machineId;
}

/**
 * Get the mac address of the machine and hash it.
 * @returns {Promise<string>} A 32-byte hash of the mac address.
 */
async function getMacMachineId(): Promise<string | undefined> {
  try {
    const macAddress = getMac();
    return crypto.createHash("shake256", { outputLength: 16 /* 32 byts */ }).update(macAddress, "utf8").digest("hex");
  } catch (err) {
    logger.error(err as any);
    return undefined;
  }
}

const invalidMacAddresses = new Set(["00:00:00:00:00:00", "ff:ff:ff:ff:ff:ff", "ac:de:48:00:11:22"]);

function validateMacAddress(candidate: string): boolean {
  const tempCandidate = candidate.replace(/\-/g, ":").toLowerCase();
  return !invalidMacAddresses.has(tempCandidate);
}

function getMac(): string {
  const ifaces = networkInterfaces();
  for (let name in ifaces) {
    const networkInterface = ifaces[name];
    if (networkInterface) {
      for (const { mac } of networkInterface) {
        if (validateMacAddress(mac)) {
          return mac;
        }
      }
    }
  }

  throw new Error("Unable to retrieve mac address (unexpected format)");
}
