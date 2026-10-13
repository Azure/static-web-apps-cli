import "../../tests/_mocks/fs.js";
import childProcess from "node:child_process";
import { createRequire } from "node:module";
import { X509Certificate, createPrivateKey } from "node:crypto";
import { vol, fs } from "memfs";
import os from "node:os";

vi.mock("./utils/logger.js", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), silly: vi.fn() },
}));

describe("SSL without executable discovery", () => {
  let ssl: typeof import("./ssl.js");
  let importLaunches: { api: string; args: unknown[] }[];
  const launches: { api: string; args: unknown[] }[] = [];
  const require = createRequire(import.meta.url);

  function interceptProcesses() {
    // pem is CommonJS, so vi.mock alone cannot intercept its require(). Patch
    // the actual Node object BEFORE loading ssl (or pem).
    for (const api of ["spawn", "exec", "execFile", "execSync", "execFileSync", "fork"] as const) {
      vi.spyOn(childProcess, api).mockImplementation(((...args: unknown[]) => {
        launches.push({ api, args });
        throw new Error("External process disabled by SSL regression test");
      }) as any);
    }
    vi.spyOn(childProcess, "spawnSync").mockImplementation(((...args: unknown[]) => {
      launches.push({ api: "spawnSync", args });
      return { status: 0, stdout: Buffer.from("OpenSSL 3.0.0"), stderr: Buffer.alloc(0) };
    }) as any);
  }

  beforeAll(async () => {
    interceptProcesses();
    ssl = await import("./ssl.js");
    importLaunches = launches.splice(0);
  });

  beforeEach(() => {
    launches.length = 0;
    interceptProcesses();
    // Never let the baseline generation path create temporary real files or
    // run openssl. A pure in-process generator must still work when this
    // external dependency is unavailable.
    let pemPath: string;
    try {
      pemPath = require.resolve("pem");
    } catch (error) {
      // GREEN may remove pem from the lockfile entirely. It is only an
      // optional interception target, never a required generator fixture.
      if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") return;
      throw error;
    }
    if (require.cache[pemPath]) {
      vi.spyOn(require("pem"), "createCertificate").mockImplementation((...args: unknown[]) =>
        (args[1] as (error: Error) => void)(new Error("External certificate generator unavailable")),
      );
    }
  });

  it("does not launch a subprocess when SSL is merely imported (even when SSL is disabled)", () => {
    expect(importLaunches).toEqual([]);
  });

  it("generates a strong certificate with subject and SAN metadata without an external generator", async () => {
    vol.reset();
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    const generated = ssl.getCertificate({
      selfSigned: true,
      days: 365,
      commonName: "localhost",
      organization: "SWA regression",
      organizationUnit: "Engineering",
      emailAddress: "secure@microsoft.com",
      altNames: ["localhost", "127.0.0.1"],
    });
    await expect(generated).resolves.toBe("/home/tester/.swa/certificates/ssl/swa-cli-UNSIGNED.pem");
    const result = await generated;
    expect(launches).toEqual([]);
    const content = fs.readFileSync(result, "utf8") as string;
    const certificatePem = content.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)?.[0] ?? content;
    const certificate = new X509Certificate(certificatePem);
    const key = createPrivateKey(content);
    // One concept: generated certificate retains the public TLS contract.
    expect(key.asymmetricKeyDetails?.modulusLength).toBeGreaterThanOrEqual(2048);
    const forge = require("node-forge");
    expect(forge.pki.certificateFromPem(certificatePem).signatureOid).toBe(forge.pki.oids.sha256WithRSAEncryption);
    expect(certificate.subject).toContain("CN=localhost");
    expect(certificate.subject).toContain("O=SWA regression");
    expect(certificate.subject).toContain("OU=Engineering");
    expect(certificate.subjectAltName).toContain("DNS:localhost");
    expect(certificate.subjectAltName).toContain("IP Address:127.0.0.1");
    expect(certificate.checkPrivateKey(key)).toBe(true);
    expect(Date.parse(certificate.validTo) - Date.parse(certificate.validFrom)).toBeGreaterThanOrEqual(364 * 24 * 60 * 60 * 1000);
  });

  it("reuses a fresh certificate cache without consulting the external generator", async () => {
    vol.reset();
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    vol.fromJSON({ "/home/tester/.swa/certificates/ssl/swa-cli-UNSIGNED.pem": "cached certificate fixture" });
    const before = launches.length;
    await ssl.getCertificate({ selfSigned: true });
    expect(launches.length).toBe(before);
    expect(fs.readFileSync("/home/tester/.swa/certificates/ssl/swa-cli-UNSIGNED.pem", "utf8")).toBe("cached certificate fixture");
  });

  it("clamps small RSA requests and preserves IPv6 SAN plus short requested validity", async () => {
    // Arrange
    vol.reset();
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    // Act
    const file = await ssl.getCertificate({ keyBitsize: 1024, days: 2, commonName: "local.test", altNames: ["::1", "127.0.0.1"] });
    const content = fs.readFileSync(file, "utf8") as string;
    const certificate = new X509Certificate(content);
    // Assert: generated TLS material respects the strong-certificate contract.
    expect(createPrivateKey(content).asymmetricKeyDetails?.modulusLength).toBeGreaterThanOrEqual(2048);
    expect(certificate.subjectAltName).toContain("IP Address:0:0:0:0:0:0:0:1");
    expect(Date.parse(certificate.validTo) - Date.parse(certificate.validFrom)).toBe(2 * 24 * 60 * 60 * 1000);
    expect(launches).toEqual([]);
  });

  it("regenerates an age-expired cache in process", async () => {
    // Arrange: policy is file age, not certificate notAfter.
    vol.reset();
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    const cache = "/home/tester/.swa/certificates/ssl/swa-cli-UNSIGNED.pem";
    vol.fromJSON({ [cache]: "old inert cache" });
    const stat = fs.promises.stat.bind(fs.promises);
    vi.spyOn(fs.promises, "stat").mockImplementation(async (...args) => {
      const result = await stat(...args);
      result.ctime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      return result;
    });
    // Act
    const file = await ssl.getCertificate({ days: 1 });
    // Assert
    expect(file).toBe(cache);
    expect(() => new X509Certificate(fs.readFileSync(file, "utf8") as string)).not.toThrow();
    expect(launches).toEqual([]);
  });

  it.each([0, -1, 1.5])("rejects invalid validity %s without executing a generator", async (days) => {
    // Arrange
    vol.reset();
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    // Act / Assert
    await expect(ssl.getCertificate({ days })).rejects.toThrow(/positive integer/);
    expect(launches).toEqual([]);
  });
});
