import "../../tests/_mocks/fetch.js";
import "../../tests/_mocks/fs.js";
import "../../tests/_mocks/posix.js";
import { childProcess, directLaunches, mockInternalProcesses } from "../../tests/_mocks/internal-process.js";

import { vol, fs } from "memfs";
import { PassThrough } from "node:stream";
import os from "node:os";
import process from "node:process";
import * as fct from "./func-core-tools.js";
import * as nodeFetch from "node-fetch";
import { Response } from "node-fetch";
//import AdmZip from "adm-zip";

import { logger } from "../core/utils/logger.js";
vi.spyOn(logger, "log").mockImplementation(() => {});
vi.spyOn(logger, "warn").mockImplementation(() => {});
vi.spyOn(logger, "error").mockImplementation(() => {});

const fetch = vi.mocked(nodeFetch).default;

// SKIPPED: Mock the ZIP functionality
// vi.mock("adm-zip", async () => {
//   const actual = await vi.importActual("adm-zip");
//   (actual.prototype as any).extractAllTo = () => {
//     vol.fromJSON({
//       "/home/user/.swa/core-tools/v4/func": "",
//       "/home/user/.swa/core-tools/v4/gozip": "",
//     });
//   }
//   return actual;
// });

function mockResponse(response: any, status = 200) {
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(response), { status }));
}

function mockBinaryResponse(response: string, status = 200) {
  const stream = new PassThrough();
  stream.write(response);
  stream.end();
  const packageResponse = new Response(stream, {
    status: status,
    headers: {
      "content-length": response.length.toString(),
    },
  });
  fetch.mockResolvedValueOnce(packageResponse);
}

describe("internal executable identity (no fixture execution)", () => {
  let getCoreToolsBinary: typeof fct.getCoreToolsBinary;
  let resetCachedInstalledSystemCoreToolsVersion: typeof fct.resetCachedInstalledSystemCoreToolsVersion;

  beforeEach(async () => {
    // Keep mocked proxy/download dependencies separate from the original fetch tests.
    vi.resetModules();
    vi.doMock("./utils/fetch-proxy.js", () => ({ fetchWithProxy: vi.fn() }));
    vi.doMock("./download-binary-helper.js", () => ({ downloadAndValidateBinary: vi.fn() }));
    vi.doMock("./utils/logger.js", () => ({
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), silly: vi.fn(), info: vi.fn() },
    }));
    ({ getCoreToolsBinary, resetCachedInstalledSystemCoreToolsVersion } = await import("./func-core-tools.js"));
    vol.reset();
    resetCachedInstalledSystemCoreToolsVersion();
    vi.spyOn(os, "platform").mockReturnValue("linux");
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    vi.spyOn(process, "cwd").mockReturnValue("/workspace");
    vi.stubEnv("PATH", "/trusted/bin");
    vol.fromJSON({
      "/workspace/func": "inert fixture",
      "/workspace/dab": "inert fixture",
      "/workspace/relative-tools/func": "inert fixture",
      "/workspace/relative-tools/dab": "inert fixture",
      "/trusted/bin/func": "inert fixture",
      "/trusted/bin/dab": "inert fixture",
    });
    for (const file of Object.keys(vol.toJSON())) fs.chmodSync(file, 0o755);
    const { fetchWithProxy } = await import("./utils/fetch-proxy.js");
    vi.mocked(fetchWithProxy).mockResolvedValue({
      json: async () => [{ version: "latest", versionId: "1.2.3" }],
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetCachedInstalledSystemCoreToolsVersion();
  });

  it("probes installed Functions with an absolute executable and argv, not a shell", async () => {
    mockInternalProcesses("4.0.0");
    await getCoreToolsBinary();
    expect(childProcess.exec.mock.calls).toEqual([]);
    expect(directLaunches()).toContainEqual(expect.objectContaining({ file: "/trusted/bin/func", args: ["--version"] }));
  });

  it("returns the same trusted Functions identity selected for probing", async () => {
    vi.stubEnv("PATH", "/workspace/relative-tools:/trusted/bin");
    mockInternalProcesses("4.0.0");
    const binary = await getCoreToolsBinary();
    expect(binary).toBe("/workspace/relative-tools/func");
    expect(directLaunches()).toContainEqual(expect.objectContaining({ file: binary, args: ["--version"] }));
  });

  it("preserves absolute cached Functions downloads when no compatible installed version exists", async () => {
    mockInternalProcesses("2.0.0");
    vol.fromJSON({
      "/home/tester/.swa/core-tools/v4/.release-version": "4.3.2",
      "/home/tester/.swa/core-tools/v4/func": "inert fixture",
    });
    const binary = await getCoreToolsBinary();
    expect(binary).toBe("/home/tester/.swa/core-tools/v4/func");
  });
});

describe("funcCoreTools", () => {
  beforeEach(() => {
    vol.reset();
  });

  describe("fct.isCoreToolsVersionCompatible()", () => {
    it("should return true for compatible versions", () => {
      expect(fct.isCoreToolsVersionCompatible(3, 10)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(2, 10)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(3, 11)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(2, 11)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(4, 12)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(3, 12)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(2, 12)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(4, 13)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(3, 13)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(2, 13)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(4, 14)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(3, 14)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(2, 14)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(4, 15)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(3, 15)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(4, 16)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(3, 16)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(2, 16)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(4, 17)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(3, 17)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(2, 17)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(4, 18)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(3, 18)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(2, 18)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(4, 19)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(3, 19)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(2, 19)).toBe(false);
      expect(fct.isCoreToolsVersionCompatible(4, 20)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(3, 20)).toBe(true);
      expect(fct.isCoreToolsVersionCompatible(2, 20)).toBe(false);
    });
  });

  describe("detectTargetCoreToolsVersion()", () => {
    it("should return the latest valid version for each Node version", () => {
      expect(fct.detectTargetCoreToolsVersion(10)).toBe(2);
      expect(fct.detectTargetCoreToolsVersion(11)).toBe(2);
      expect(fct.detectTargetCoreToolsVersion(12)).toBe(2);
      expect(fct.detectTargetCoreToolsVersion(13)).toBe(2);
      expect(fct.detectTargetCoreToolsVersion(14)).toBe(3);
      expect(fct.detectTargetCoreToolsVersion(15)).toBe(3);
      expect(fct.detectTargetCoreToolsVersion(16)).toBe(3);
      expect(fct.detectTargetCoreToolsVersion(17)).toBe(3);
      expect(fct.detectTargetCoreToolsVersion(18)).toBe(4);
      expect(fct.detectTargetCoreToolsVersion(19)).toBe(4);
      expect(fct.detectTargetCoreToolsVersion(20)).toBe(4);
      // Unsupported Node versions should always return the latest version
      expect(fct.detectTargetCoreToolsVersion(8)).toBe(4);
      expect(fct.detectTargetCoreToolsVersion(9)).toBe(4);
      expect(fct.detectTargetCoreToolsVersion(7)).toBe(4);
      expect(fct.detectTargetCoreToolsVersion(21)).toBe(4);
    });
  });

  describe("getLatestCoreToolsRelease()", () => {
    beforeEach(() => {
      vi.spyOn(os, "platform").mockReturnValue("linux");
      vi.spyOn(os, "homedir").mockReturnValue("/home/user");
    });

    it("should return the latest release for the specified version", async () => {
      mockResponse({
        tags: {
          v4: {
            release: "4.0.0",
          },
        },
        releases: {
          "4.0.0": {
            coreTools: [
              {
                OS: "Linux",
                downloadLink: "https://abc.com/d.zip",
                sha2: "123",
                size: "full",
              },
            ],
          },
        },
      });

      const release = await fct.getLatestCoreToolsRelease(4);
      expect(release.version).toBe("4.0.0");
      expect(release.sha2).toBe("123");
    });

    it("should throw an error if tags match the specified version", async () => {
      mockResponse({
        tags: {
          v3: {},
          v4: { hidden: true },
        },
      });

      await expect(async () => await fct.getLatestCoreToolsRelease(4)).rejects.toThrowError("Error fetching Function Core Tools releases");
    });

    it("should throw an error if no release match the specified version", async () => {
      mockResponse({
        tags: {
          v4: { release: "4.0.0" },
        },
        releases: {},
      });

      await expect(async () => await fct.getLatestCoreToolsRelease(4)).rejects.toThrowError("Error fetching Function Core Tools releases");
    });

    it("should throw an error if there's no compatible package", async () => {
      mockResponse({
        tags: {
          v4: { release: "4.0.0" },
        },
        releases: {
          "4.0.0": {
            coreTools: [
              {
                OS: "Windows",
                downloadLink: "https://abc.com/d.zip",
                sha2: "123",
                size: "full",
              },
            ],
          },
        },
      });

      await expect(async () => await fct.getLatestCoreToolsRelease(4)).rejects.toThrowError("Cannot find download package for Linux");
    });

    it("should throw an error if no release match the specified version", async () => {
      fetch.mockRejectedValue(new Error("bad network"));

      await expect(async () => await fct.getLatestCoreToolsRelease(4)).rejects.toThrowError(/bad network/);
    });
  });

  describe("getCoreToolsBinary", () => {
    beforeEach(() => {
      vi.spyOn(os, "platform").mockReturnValue("linux");
      vi.spyOn(os, "homedir").mockReturnValue("/home/user");
    });

    afterEach(() => {
      fct.resetCachedInstalledSystemCoreToolsVersion();
      vi.unstubAllEnvs();
    });

    it("should return the system binary if it's compatible", async () => {
      vol.fromJSON({ "/trusted/bin/func": "inert native fixture; never executed" });
      fs.chmodSync("/trusted/bin/func", 0o755);
      vi.stubEnv("PATH", "/trusted/bin");
      mockInternalProcesses("4.0.0");
      const binary = await fct.getCoreToolsBinary();
      expect(binary).toBe("/trusted/bin/func");
      expect(childProcess.execFile).toHaveBeenCalledWith(
        "/trusted/bin/func",
        ["--version"],
        { encoding: "utf8", shell: false, env: { ...process.env } },
        expect.any(Function),
      );
      expect(childProcess.exec).not.toHaveBeenCalled();
    });

    it("should return the downloaded binary if there's no system binary", async () => {
      fct.setCachedInstalledSystemCoreToolsVersion(undefined);

      vol.fromNestedJSON({
        ["/home/user/.swa/core-tools/v4"]: { ".release-version": "4.3.2", func: "inert cached executable" },
      });
      fs.chmodSync("/home/user/.swa/core-tools/v4/func", 0o755);

      const binary = await fct.getCoreToolsBinary();

      expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
    });

    it("should return the downloaded binary if the system binary is incompatible", async () => {
      fct.setCachedInstalledSystemCoreToolsVersion(2);

      vol.fromNestedJSON({
        ["/home/user/.swa/core-tools/v4"]: { ".release-version": "4.3.2", func: "inert cached executable" },
      });
      fs.chmodSync("/home/user/.swa/core-tools/v4/func", 0o755);

      const binary = await fct.getCoreToolsBinary();
      expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
    });

    // SKIPPED: Does not work because we cannot mock adm-zip right now
    it.skip("should download core tools and return downloaded binary", async () => {
      fct.setCachedInstalledSystemCoreToolsVersion(undefined);

      mockResponse({
        tags: {
          v4: { release: "4.0.0" },
        },
        releases: {
          "4.0.0": {
            coreTools: [
              {
                OS: "Linux",
                downloadLink: "https://abc.com/d.zip",
                // Real sha2 for "package" string
                sha2: "bc4a71180870f7945155fbb02f4b0a2e3faa2a62d6d31b7039013055ed19869a",
                size: "full",
              },
            ],
          },
        },
      });
      mockBinaryResponse("package");

      vol.fromNestedJSON(
        {
          ["/home/user/.swa/core-tools/"]: {},
        },
        "/home/user",
      );

      const binary = await fct.getCoreToolsBinary();
      expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
    });

    it("should return undefined if an error occured", async () => {
      fct.setCachedInstalledSystemCoreToolsVersion(undefined);
      fetch.mockRejectedValueOnce({});
      const binary = await fct.getCoreToolsBinary();
      expect(binary).toBe(undefined);
    });
  });

  describe("downloadCoreTools", () => {
    beforeEach(() => {
      vi.spyOn(os, "platform").mockReturnValue("linux");
      vi.spyOn(os, "homedir").mockReturnValue("/home/user");
    });

    afterEach(() => {
      fct.resetCachedInstalledSystemCoreToolsVersion();
    });

    // SKIPPED: The test does not work because of adm-zip mocking right now.
    it.skip("should throw an error if the download is corrupted", async () => {
      fct.setCachedInstalledSystemCoreToolsVersion(undefined);

      mockResponse({
        tags: {
          v4: { release: "4.0.0" },
        },
        releases: {
          "4.0.0": {
            coreTools: [
              {
                OS: "Linux",
                downloadLink: "https://abc.com/d.zip",
                sha2: "123",
                size: "full",
              },
            ],
          },
        },
      });

      mockBinaryResponse("package");
      vol.fromNestedJSON({ ["/home/user/.swa/core-tools/"]: {} });
      await expect(async () => await fct.downloadCoreTools(4)).rejects.toThrowError(/SHA2 mismatch/);
    });
  });
});
