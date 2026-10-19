import childProcess, { ChildProcess } from "node:child_process";
import { X509Certificate, createPrivateKey, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { PassThrough } from "node:stream";
import type { PEMOptions } from "./ssl.js";

const moduleLoader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("node:module", () => ({ createRequire: () => moduleLoader.load }));
vi.mock("./utils/logger.js", () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), silly: vi.fn() } }));

interface Certificate {
  csr: string;
  serviceKey: string;
  certificate: string;
}
type Callback = (error: Error | null, certificate: Certificate) => void;

describe("SSL trusted bootstrap and baseline PEM delegation", () => {
  let require: NodeRequire;
  let material: Certificate;
  let sandbox: string;
  let project: string;
  let cache: string;
  let executable: string;
  let generator: { config: ReturnType<typeof vi.fn>; createCertificate: ReturnType<typeof vi.fn> };
  const envKeys = ["OPENSSL_BIN", "LIBRARY", "VERSION", "CI"] as const;
  const snapshot = () => envKeys.map((key) => [key, process.env[key] ?? null]);

  beforeAll(async () => {
    require = (await vi.importActual<typeof import("node:module")>("node:module")).createRequire(import.meta.url);
    const forge = require("node-forge");
    const keys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = forge.pki.publicKeyFromPem(keys.publicKey);
    certificate.serialNumber = "01";
    certificate.validity.notBefore = new Date();
    certificate.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    certificate.setSubject([
      { name: "commonName", value: "localhost" },
      { name: "organizationName", value: "SWA regression" },
      { name: "organizationalUnitName", value: "Engineering" },
    ]);
    certificate.setIssuer(certificate.subject.attributes);
    certificate.setExtensions([
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
        ],
      },
    ]);
    certificate.sign(forge.pki.privateKeyFromPem(keys.privateKey), forge.md.sha256.create());
    material = { csr: "inert CSR fixture", serviceKey: keys.privateKey, certificate: forge.pki.certificateToPem(certificate) };
  });

  beforeEach(() => {
    vi.resetModules();
    delete require.cache[require.resolve("pem")];
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swa-tls-contract-"));
    project = path.join(sandbox, "project");
    const tools = path.join(sandbox, "external tools");
    fs.mkdirSync(project);
    fs.mkdirSync(tools);
    const projectTools = path.join(project, "bin");
    fs.mkdirSync(projectTools);
    const filename = process.platform === "win32" ? "openssl.exe" : "openssl";
    executable = path.join(tools, filename);
    fs.writeFileSync(executable, "inert native identity fixture", { mode: 0o755 });
    fs.writeFileSync(path.join(projectTools, filename), "inert project canary", { mode: 0o755 });
    executable = fs.realpathSync(executable);
    cache = path.join(sandbox, "home", ".swa", "certificates", "ssl", "swa-cli-UNSIGNED.pem");
    vi.spyOn(os, "homedir").mockReturnValue(path.join(sandbox, "home"));
    vi.spyOn(process, "cwd").mockReturnValue(project);
    vi.stubEnv("PATH", tools);
    vi.stubEnv("PEMJS_TMPDIR", sandbox);
    for (const key of envKeys) {
      vi.stubEnv(key, "");
      delete process.env[key];
    }
    generator = { config: vi.fn(), createCertificate: vi.fn((_options: PEMOptions, callback: Callback) => callback(null, material)) };
    moduleLoader.load.mockReturnValue(generator);
    for (const api of ["spawn", "spawnSync", "exec", "execFile", "execSync", "execFileSync", "fork"] as const) {
      vi.spyOn(childProcess, api).mockImplementation(() => {
        throw new Error(`Unexpected unbound ${api} in TLS test`);
      });
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete require.cache[require.resolve("pem")];
    fs.rmSync(sandbox, { recursive: true });
  });

  it("does not load pem or launch a subprocess on SSL import", async () => {
    await import("./ssl.js");
    expect(moduleLoader.load).not.toHaveBeenCalled();
  });

  it("reuses a fresh cache without requiring OpenSSL or loading pem", async () => {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, "cached certificate fixture");
    vi.stubEnv("PATH", project);
    const ssl = await import("./ssl.js");
    expect(await ssl.getCertificate({ selfSigned: true })).toBe(cache);
    expect(moduleLoader.load).not.toHaveBeenCalled();
    expect(fs.readFileSync(cache, "utf8")).toBe("cached certificate fixture");
  });

  it("delegates TLS metadata and caches the generator's matching SHA256/2048-bit key and certificate unchanged", async () => {
    const options = {
      selfSigned: true,
      days: 365,
      commonName: "localhost",
      organization: "SWA regression",
      organizationUnit: "Engineering",
      altNames: ["localhost", "127.0.0.1"],
    };
    const ssl = await import("./ssl.js");
    expect(await ssl.getCertificate(options)).toBe(cache);
    expect(generator.createCertificate).toHaveBeenCalledWith(options, expect.any(Function));
    const content = fs.readFileSync(cache, "utf8");
    const certificate = new X509Certificate(material.certificate);
    expect(content === [material.csr, material.serviceKey, material.certificate].join("\n")).toBe(true);
    expect(createPrivateKey(content).asymmetricKeyDetails?.modulusLength).toBeGreaterThanOrEqual(2048);
    expect(require("node-forge").pki.certificateFromPem(material.certificate).signatureOid).toBe(
      require("node-forge").pki.oids.sha256WithRSAEncryption,
    );
    expect(certificate.subject).toContain("CN=localhost");
    expect(certificate.subject).toContain("O=SWA regression");
    expect(certificate.subject).toContain("OU=Engineering");
    expect(certificate.subjectAltName).toContain("DNS:localhost");
    expect(certificate.subjectAltName).toContain("IP Address:127.0.0.1");
    expect(certificate.checkPrivateKey(createPrivateKey(content))).toBe(true);
    expect(Date.parse(certificate.validTo) - Date.parse(certificate.validFrom)).toBeGreaterThanOrEqual(364 * 24 * 60 * 60 * 1000);
  });

  it("forwards supplied key/CSR, hash, config, IPv6 SAN and requested size/validity rather than imposing new restrictions", async () => {
    const options = {
      serviceKey: material.serviceKey,
      csr: "caller CSR",
      hash: "sha512",
      config: "caller extension config",
      keyBitsize: 1024,
      days: 2,
      altNames: ["::1", "127.0.0.1"],
    };
    const ssl = await import("./ssl.js");
    await ssl.getCertificate(options);
    expect(generator.createCertificate.mock.calls[0]?.[0] === options).toBe(true);
  });

  it("regenerates an age-expired cache through the bound generator", async () => {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, "old inert cache");
    const stat = fs.promises.stat.bind(fs.promises);
    vi.spyOn(fs.promises, "stat").mockImplementation(async (...args) => {
      const result = await stat(...args);
      result.ctime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      return result;
    });
    const ssl = await import("./ssl.js");
    expect(await ssl.getCertificate({ days: 1 })).toBe(cache);
    expect(generator.createCertificate).toHaveBeenCalledOnce();
    expect(fs.readFileSync(cache, "utf8") === [material.csr, material.serviceKey, material.certificate].join("\n")).toBe(true);
  });

  it.each([false, true])("restores present/absent bootstrap env after successful load (present=%s)", async (present) => {
    if (present) {
      process.env.OPENSSL_BIN = "openssl";
      process.env.LIBRARY = "fixture";
    }
    const before = snapshot();
    moduleLoader.load.mockImplementation(() => {
      expect(process.env.OPENSSL_BIN).toBe(executable);
      expect(process.env.LIBRARY).toBeUndefined();
      return generator;
    });
    const ssl = await import("./ssl.js");
    await ssl.getCertificate({ selfSigned: true });
    expect(snapshot()).toEqual(before);
    expect(generator.config).toHaveBeenCalledWith({ pathOpenSSL: executable });
  });

  it.each([false, true])("restores present/absent bootstrap env after a synchronous load failure (present=%s)", async (present) => {
    if (present) {
      process.env.OPENSSL_BIN = "openssl";
      process.env.LIBRARY = "fixture";
    }
    const before = snapshot();
    const failure = new Error("inert pem load failure");
    moduleLoader.load.mockImplementation(() => {
      expect(process.env.OPENSSL_BIN).toBe(executable);
      expect(process.env.LIBRARY).toBeUndefined();
      throw failure;
    });
    const ssl = await import("./ssl.js");
    await expect(ssl.getCertificate({ selfSigned: true })).rejects.toBe(failure);
    expect(snapshot()).toEqual(before);
    expect(fs.existsSync(cache)).toBe(false);
  });

  it("binds the actual pem eager probe and later dependency dispatch despite CI override and restored/mutated env", async () => {
    process.env.OPENSSL_BIN = "openssl";
    process.env.CI = "true";
    process.env.LIBRARY = "fixture";
    process.env.VERSION = "1";
    const relative = path.join(project, "openssl", "fixture_v1", "bin", "openssl");
    fs.mkdirSync(path.dirname(relative), { recursive: true });
    fs.writeFileSync(relative, "inert CI canary");
    const exists = fs.existsSync;
    vi.spyOn(fs, "existsSync").mockImplementation((file) =>
      String(file).replace(/\\/g, "/") === "./openssl/fixture_v1/bin/openssl" ? exists(relative) : exists(file),
    );
    const before = snapshot();
    const launches: { api: string; executable: string }[] = [];
    let guarded = false;
    vi.spyOn(childProcess, "spawnSync").mockImplementation((file) => {
      launches.push({ api: "eager", executable: file });
      if (guarded) expect(process.env.LIBRARY).toBeUndefined();
      return { pid: 0, status: 0, signal: null, output: [], stdout: Buffer.from("OpenSSL 3.0.0"), stderr: Buffer.alloc(0) };
    });
    vi.spyOn(childProcess, "spawn").mockImplementation((file) => {
      launches.push({ api: "later", executable: file });
      const child = new ChildProcess();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      queueMicrotask(() => {
        child.stdout!.emit("data", Buffer.from("Modulus=CAFEBABE\n"));
        child.emit("exit", 0);
        child.emit("close", 0);
      });
      return child;
    });
    require("pem");
    expect(launches).toEqual([{ api: "eager", executable: "./openssl/fixture_v1/bin/openssl" }]);
    delete require.cache[require.resolve("pem")];
    launches.length = 0;
    process.env.OPENSSL_BIN = "openssl";
    guarded = true;
    moduleLoader.load.mockImplementation((name: string) => {
      const actualPem: {
        createCertificate(options: PEMOptions, callback: Callback): void;
        getModulus(key: string, callback: (error: Error | null, result: { modulus: string }) => void): void;
      } = require(name);
      vi.spyOn(actualPem, "createCertificate").mockImplementation((_options, callback) => {
        expect(snapshot()).toEqual(before);
        process.env.OPENSSL_BIN = relative;
        actualPem.getModulus("inert test key", (error, result) => {
          if (!error) expect(result.modulus).toBe("CAFEBABE");
          callback(error, material);
        });
      });
      return actualPem;
    });
    const ssl = await import("./ssl.js");
    await ssl.getCertificate({ selfSigned: true });
    expect(launches).toEqual([
      { api: "eager", executable },
      { api: "later", executable },
    ]);
  });

  it("surfaces the generator callback error without caching success-shaped material", async () => {
    const error = new Error("inert OpenSSL generation failure");
    generator.createCertificate.mockImplementation((_options: PEMOptions, callback: Callback) => callback(error, material));
    const ssl = await import("./ssl.js");
    await expect(ssl.getCertificate({ selfSigned: true })).rejects.toBe(error);
    expect(fs.existsSync(cache)).toBe(false);
  });

  it("rejects a project OpenSSL override before loading or probing pem", async () => {
    process.env.OPENSSL_BIN = path.join(project, "bin", process.platform === "win32" ? "openssl.exe" : "openssl");
    const ssl = await import("./ssl.js");
    await expect(ssl.getCertificate({ selfSigned: true })).rejects.toThrow(/trusted native OpenSSL/);
    expect(moduleLoader.load).not.toHaveBeenCalled();
  });
});
