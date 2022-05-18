import baseFs from "fs";
import os from "os";
import path from "path";
import pem from "pem";
import { logger } from "./utils";
const fs = baseFs.promises;
const { mkdir, writeFile } = fs;

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

  /** Hash function to use (either md5 sha1 or sha256, defaults to sha256) */
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

interface SSLCertificate extends Pick<PEMOptions, "csr" | "clientKey" | "serviceKey"> {
  certificate: string;
}

/**
 * Generate a new SSL certificate. This will create a new key and certificate and cache them in the
 * `~/.swa/certificates/ssl` directory, for one month.
 *
 * @param options PEM options (passed to the "`pem`" npm library)
 * @returns The abosulte filepath to the PEM file from cache.
 */
export async function getCertificate(options: PEMOptions): Promise<string> {
  const cacheDir = path.join(os.homedir(), ".swa", "certificates", "ssl");
  const cachePath = path.join(cacheDir, "swa-cli-UNSIGNED.pem");

  try {
    logger.silly(`Checking for cached certificate at ${cachePath}`);

    const [stat, unsignedCertificate] = await Promise.all([fs.stat(cachePath), fs.readFile(cachePath, "utf8")]);

    if (Date.now() - stat.ctime.valueOf() > ONE_MONTH) {
      throw new Error("Certificate is too old, a new one will be generated.");
    }

    logger.silly("Certificate is valid, using it.");
    return unsignedCertificate;
  } catch {
    logger.silly("No cached certificate found.");

    logger.silly("Creating new certificate...");
    const unsignedCertificate = await createCertificate(options);

    logger.silly("Writing certificate to cache...");

    const pemContent = [unsignedCertificate.csr, unsignedCertificate.serviceKey, unsignedCertificate.certificate].join("\n");

    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, pemContent);

    return cachePath;
  }
}

async function createCertificate(options: PEMOptions): Promise<SSLCertificate> {
  return new Promise((resolve, reject) => {
    pem.createCertificate(options, (err: Error, keys: SSLCertificate) => {
      if (err) {
        reject(err);
      } else {
        resolve(keys);
      }
    });
  });
}
