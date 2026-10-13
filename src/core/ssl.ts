import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isIP } from "node:net";
import selfsigned from "selfsigned";
import { logger } from "./utils/logger.js";

const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

export interface PEMOptions {
  /** PEM encoded certificate */
  serviceCertificate?: string;

  /** Private key for signing the certificate, if not defined a new one is generated */
  serviceKey?: string;

  /** Password of the service key */
  serviceKeyPassword?: string;

  /** If set to true and serviceKey is not defined, use clientKey for signing */
  selfSigned?: boolean;

  /** Set a serial max. 20 octets - only together with options.serviceCertificate */
  serial?: number | string;

  /** Set the name of the serial file, without extension. - only together with options.serviceCertificate and never in tandem with options.serial */
  serialFile?: string;

  /** Built-in certificates always use SHA256. */
  hash?: string;

  /** CSR for the certificate, if not defined a new one is generated */
  csr?: string;

  /** Certificate expire time in days */
  days?: number;

  /** Password of the client key */
  clientKeyPassword?: string;

  /** extension config file - without '-extensions v3_req' */
  extFile?: string;

  /** extension config file - with '-extensions v3_req' */
  config?: string;

  // CSR options

  /** Optional client key to use */
  clientKey?: string;

  /** If clientKey is undefined, bit size to use for generating a new key (defaults to 2048) */
  keyBitsize?: number;

  /** CSR country field */
  country?: string;

  /** CSR state field */
  state?: string;

  /** CSR locality field */
  locality?: string;

  /** CSR organization field */
  organization?: string;

  /** CSR organization unit field */
  organizationUnit?: string;

  /** CSR common name field (default: localhost) */
  commonName?: string;

  /** CSR email address field */
  emailAddress?: string;

  /** CSR config file - only used if no options.csr is provided */
  csrConfigFile?: string;

  /** is a list of subjectAltNames in the subjectAltName field - only used if no options.csr is provided */
  altNames?: string[];
}

/**
 * Generate a new SSL certificate. This will create a new key and certificate and cache them in the
 * `~/.swa/certificates/ssl` directory, for one month.
 *
 * @param options Subject, validity and SAN options for an in-process self-signed certificate.
 * @returns The abosulte filepath to the PEM file from cache.
 */
export async function getCertificate(options: PEMOptions): Promise<string> {
  const cacheDir = path.join(os.homedir(), ".swa", "certificates", "ssl");
  const cachePath = path.join(cacheDir, "swa-cli-UNSIGNED.pem");

  try {
    logger.silly(`Checking for cached certificate at ${cachePath}`);

    const [stat] = await Promise.all([fs.stat(cachePath), fs.readFile(cachePath, "utf8")]);

    if (Date.now() - stat.ctime.valueOf() > ONE_MONTH) {
      throw new Error("Certificate is too old, a new one will be generated.");
    }

    logger.silly("Certificate is valid, using it.");
    return cachePath;
  } catch {
    logger.silly("No cached certificate found.");

    logger.silly("Creating new certificate...");
    const unsignedCertificate = await createCertificate(options);

    logger.silly("Writing certificate to cache...");

    const pemContent = [unsignedCertificate.private, unsignedCertificate.cert].join("\n");

    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cachePath, pemContent);

    return cachePath;
  }
}

async function createCertificate(options: PEMOptions): Promise<{ private: string; cert: string }> {
  const unsupported = [
    "serviceCertificate",
    "serviceKey",
    "serviceKeyPassword",
    "serial",
    "serialFile",
    "csr",
    "clientKeyPassword",
    "extFile",
    "config",
    "clientKey",
    "csrConfigFile",
  ] as const;
  if (unsupported.some((option) => options[option] !== undefined)) {
    throw new Error("Custom signing keys/CSR options are not supported by the built-in certificate generator. Use --ssl-cert and --ssl-key.");
  }
  const commonName = options.commonName ?? "localhost";
  const attrs = [
    { name: "commonName", value: commonName },
    { name: "countryName", value: options.country },
    { name: "stateOrProvinceName", value: options.state },
    { name: "localityName", value: options.locality },
    { name: "organizationName", value: options.organization },
    { name: "organizationalUnitName", value: options.organizationUnit },
    { name: "emailAddress", value: options.emailAddress },
  ].filter((attribute): attribute is { name: string; value: string } => attribute.value !== undefined);
  const altNames = [...new Set([commonName, ...(options.altNames ?? [])])].map((name) =>
    isIP(name) ? { type: 7, ip: name } : { type: 2, value: name },
  );
  const keySize = Math.max(2048, options.keyBitsize ?? 2048);
  const days = options.days ?? 365;
  if (!Number.isInteger(keySize) || !Number.isInteger(days) || days < 1) {
    throw new Error("Certificate key size and validity must be positive integer values.");
  }
  return new Promise((resolve, reject) => {
    selfsigned.generate(
      attrs,
      {
        keySize,
        days,
        algorithm: "sha256",
        extensions: [
          { name: "basicConstraints", cA: false },
          { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
          { name: "extKeyUsage", serverAuth: true },
          { name: "subjectAltName", altNames },
        ],
      },
      (err, keys) => {
        if (err) {
          reject(err);
        } else {
          resolve(keys);
        }
      },
    );
  });
}
