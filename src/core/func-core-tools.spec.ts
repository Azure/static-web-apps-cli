import "../../tests/_mocks/fetch.js";
import "../../tests/_mocks/fs.js";

import { Buffer } from "node:buffer";
import { vol } from "memfs";
import { type ObjectEncodingOptions } from "node:fs";
import { sep } from "node:path";
import { Readable } from "node:stream";
import cp, { ExecException } from "node:child_process";
import {
  detectTargetCoreToolsVersion,
  downloadCoreTools,
  getCoreToolsBinary,
  getLatestCoreToolsRelease,
  isCoreToolsVersionCompatible,
} from "./func-core-tools.js";
import * as nodeFetch from "node-fetch";
import { Response } from "node-fetch";

import { logger } from "../core/utils/logger.js";
vi.spyOn(logger, "log").mockImplementation(() => {});
vi.spyOn(logger, "warn").mockImplementation(() => {});
vi.spyOn(logger, "error").mockImplementation(() => {});

const fetch = vi.mocked(nodeFetch).default;

vi.mock("node:process", () => ({ versions: { node: "18.0.0" } }));
vi.mock("node:os", () => ({ platform: () => "linux", homedir: () => "/home/user" }));
vi.mock("adm-zip", () =>
  vi.fn(() => {
    return {
      extractAllTo: () => {
        vol.fromJSON({
          "/home/user/.swa/core-tools/v4/func": "",
          "/home/user/.swa/core-tools/v4/gozip": "",
        });
      },
    };
  })
);

function mockResponse(response: any, status = 200) {
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(response), { status }));
}

describe("funcCoreTools", () => {
  afterEach(() => {
    vol.reset();
  });

  describe("isCoreToolsVersionCompatible()", () => {
    it("should return true for compatible versions", () => {
      expect(isCoreToolsVersionCompatible(4, 10)).toBe(false);
      expect(isCoreToolsVersionCompatible(3, 10)).toBe(true);
      expect(isCoreToolsVersionCompatible(2, 10)).toBe(true);
      expect(isCoreToolsVersionCompatible(3, 11)).toBe(true);
      expect(isCoreToolsVersionCompatible(2, 11)).toBe(false);
      expect(isCoreToolsVersionCompatible(4, 12)).toBe(false);
      expect(isCoreToolsVersionCompatible(3, 12)).toBe(true);
      expect(isCoreToolsVersionCompatible(2, 12)).toBe(false);
      expect(isCoreToolsVersionCompatible(3, 13)).toBe(true);
      expect(isCoreToolsVersionCompatible(4, 14)).toBe(true);
      expect(isCoreToolsVersionCompatible(3, 14)).toBe(true);
      expect(isCoreToolsVersionCompatible(2, 14)).toBe(false);
      expect(isCoreToolsVersionCompatible(4, 15)).toBe(true);
      expect(isCoreToolsVersionCompatible(3, 15)).toBe(false);
      expect(isCoreToolsVersionCompatible(4, 16)).toBe(true);
      expect(isCoreToolsVersionCompatible(3, 16)).toBe(false);
      expect(isCoreToolsVersionCompatible(2, 16)).toBe(false);
      expect(isCoreToolsVersionCompatible(4, 17)).toBe(true);
      expect(isCoreToolsVersionCompatible(3, 17)).toBe(false);
      expect(isCoreToolsVersionCompatible(2, 17)).toBe(false);
      expect(isCoreToolsVersionCompatible(4, 18)).toBe(true);
      expect(isCoreToolsVersionCompatible(3, 18)).toBe(false);
      expect(isCoreToolsVersionCompatible(2, 18)).toBe(false);
    });
  });

  describe("detectTargetCoreToolsVersion()", () => {
    it("should return the latest valid version for each Node version", () => {
      expect(detectTargetCoreToolsVersion(8)).toBe(2);
      expect(detectTargetCoreToolsVersion(9)).toBe(2);
      expect(detectTargetCoreToolsVersion(10)).toBe(3);
      expect(detectTargetCoreToolsVersion(11)).toBe(3);
      expect(detectTargetCoreToolsVersion(12)).toBe(3);
      expect(detectTargetCoreToolsVersion(13)).toBe(3);
      expect(detectTargetCoreToolsVersion(14)).toBe(4);
      expect(detectTargetCoreToolsVersion(15)).toBe(4);
      expect(detectTargetCoreToolsVersion(16)).toBe(4);
      // Unsupported Node versions should always return the latest version
      expect(detectTargetCoreToolsVersion(7)).toBe(4);
      expect(detectTargetCoreToolsVersion(17)).toBe(4);
    });
  });

  describe("getLatestCoreToolsRelease()", () => {
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

      const release = await getLatestCoreToolsRelease(4);
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

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError("Cannot find the latest version for v4");
    });

    it("should throw an error if no release match the specified version", async () => {
      mockResponse({
        tags: {
          v4: { release: "4.0.0" },
        },
        releases: {},
      });

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError("Cannot find release for 4.0.0");
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

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError("Cannot find download package for Linux");
    });

    it("should throw an error if no release match the specified version", async () => {
      fetch.mockRejectedValue(new Error("bad network"));

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError(/bad network/);
    });
  });

  describe("getCoreToolsBinary", () => {
    it("should return the system binary if it's compatible", async () => {
      const execMock = vi.spyOn(cp, "exec");
      execMock.mockImplementationOnce(function (
        this: cp.ChildProcess,
        _cmd: string,
        _opts: (ObjectEncodingOptions & cp.ExecOptions) | null | undefined,
        callback?: ((error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined
      ): cp.ChildProcess {
        if (callback) {
          callback(null, "4.0.0", "");
        }
        return this;
      });

      const binary = await getCoreToolsBinary();
      expect(binary).toBe("func");
    });

    it("should return the downloaded binary if there's no system binary", async () => {
      const execMock = vi.spyOn(cp, "exec");
      execMock.mockImplementationOnce(function (
        this: cp.ChildProcess,
        _cmd: string,
        _opts: (ObjectEncodingOptions & cp.ExecOptions) | null | undefined,
        callback?: ((error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined
      ): cp.ChildProcess {
        if (callback) {
          callback(null, "", "func does not exist");
        }
        return this;
      });

      vol.fromNestedJSON({
        ["/home/user/.swa/core-tools/v4"]: { ".release-version": "4.3.2" },
      });

      const binary = await getCoreToolsBinary();

      // note: we have mocked os.platform(), so we can't check for os name!
      if (sep === "/") {
        expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
      } else {
        expect(binary).toContain(":\\home\\user\\.swa\\core-tools\\v4\\func");
      }
    });

    it("should return the downloaded binary if the system binary is incompatible", async () => {
      const execMock = vi.spyOn(cp, "exec");
      execMock.mockImplementationOnce(function (
        this: cp.ChildProcess,
        _cmd: string,
        _opts: (ObjectEncodingOptions & cp.ExecOptions) | null | undefined,
        callback?: ((error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined
      ): cp.ChildProcess {
        if (callback) {
          callback(null, "3.0.0", "");
        }
        return this;
      });
      vol.fromNestedJSON({
        ["/home/user/.swa/core-tools/v4"]: { ".release-version": "4.3.2" },
      });

      const binary = await getCoreToolsBinary();
      // note: we have mocked os.platform(), so we can't check for os name!
      if (sep === "/") {
        expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
      } else {
        expect(binary).toContain(":\\home\\user\\.swa\\core-tools\\v4\\func");
      }
    });

    it("should download core tools and return downloaded binary", async () => {
      const execMock = vi.spyOn(cp, "exec");
      execMock.mockImplementationOnce(function (
        this: cp.ChildProcess,
        _cmd: string,
        _opts: (ObjectEncodingOptions & cp.ExecOptions) | null | undefined,
        callback?: ((error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined
      ): cp.ChildProcess {
        if (callback) {
          callback(null, "", "func does not exist");
        }
        return this;
      });

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

      const packageZip = Buffer.from("package");
      const packageResponse = new Response(packageZip.buffer, {
        headers: {
          "content-length": packageZip.length.toString(),
        },
      });
      fetch.mockResolvedValue(packageResponse);
      vol.fromNestedJSON({ ["/home/user/.swa/core-tools/"]: {} });

      const binary = await getCoreToolsBinary();
      // note: we have mocked os.platform(), so we can't check for os name!
      if (sep === "/") {
        expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
      } else {
        expect(binary).toContain(":\\home\\user\\.swa\\core-tools\\v4\\func");
      }
    });

    it("should return undefined if an error occured", async () => {
      const execMock = vi.spyOn(cp, "exec");
      execMock.mockImplementationOnce(function (
        this: cp.ChildProcess,
        _cmd: string,
        _opts: (ObjectEncodingOptions & cp.ExecOptions) | null | undefined,
        callback?: ((error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined
      ): cp.ChildProcess {
        if (callback) {
          callback(null, "", "func does not exist");
        }
        return this;
      });

      fetch.mockRejectedValueOnce({});

      const binary = await getCoreToolsBinary();
      expect(binary).toBe(undefined);
    });
  });

  describe("downloadCoreTools", () => {
    it("should throw an error if the download is corrupted", async () => {
      const execMock = vi.spyOn(cp, "exec");
      execMock.mockImplementationOnce(function (
        this: cp.ChildProcess,
        _cmd: string,
        _opts: (ObjectEncodingOptions & cp.ExecOptions) | null | undefined,
        callback?: ((error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined
      ): cp.ChildProcess {
        if (callback) {
          callback(null, "", "func does not exist");
        }
        return this;
      });

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

      const packageZip = Buffer.from("package");
      const packageResponse = new Response(packageZip.buffer, {
        headers: {
          "content-length": packageZip.length.toString(),
        },
      });
      fetch.mockResolvedValueOnce(packageResponse);
      vol.fromNestedJSON({ ["/home/user/.swa/core-tools/"]: {} });

      await expect(async () => await downloadCoreTools(4)).rejects.toThrowError(/SHA2 mismatch/);
    });
  });
});
