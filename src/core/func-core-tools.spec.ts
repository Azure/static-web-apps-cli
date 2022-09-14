import { Buffer } from "buffer";
import mockFs from "mock-fs";
import { sep } from "path";
import { PassThrough, Readable } from "stream";
import {
  detectTargetCoreToolsVersion,
  downloadCoreTools,
  getCoreToolsBinary,
  getLatestCoreToolsRelease,
  isCoreToolsVersionCompatible,
} from "./func-core-tools";

import { logger } from "../core";
jest.spyOn(logger, "log").mockImplementation();
jest.spyOn(logger, "warn").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

jest.mock("process", () => ({ versions: { node: "16.0.0" } }));
jest.mock("os", () => ({ platform: () => "linux", homedir: () => "/home/user" }));
jest.mock("child_process", () => ({ exec: jest.fn() }));
jest.mock("node-fetch", () => jest.fn());

jest.mock("unzipper", () => ({
  Extract: () => {
    const fakeStream = new PassThrough() as any;
    fakeStream.promise = () => Promise.resolve();
    mockFs(
      {
        "/home/user/.swa/core-tools/v4/func": "",
        "/home/user/.swa/core-tools/v4/gozip": "",
      },
      { createTmp: false, createCwd: false }
    );
    return fakeStream;
  },
}));

class HeadersMock {
  constructor(public headers: Record<string, string>) {}
  get(key: string): string | undefined {
    return this.headers[key];
  }
}

describe("funcCoreTools", () => {
  afterEach(() => {
    mockFs.restore();
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
      expect(isCoreToolsVersionCompatible(4, 17)).toBe(false);
      expect(isCoreToolsVersionCompatible(3, 17)).toBe(false);
      expect(isCoreToolsVersionCompatible(2, 17)).toBe(false);
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
      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
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
            }),
        })
      );

      const release = await getLatestCoreToolsRelease(4);
      expect(release.version).toBe("4.0.0");
      expect(release.sha2).toBe("123");
    });

    it("should throw an error if tags match the specified version", async () => {
      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              tags: {
                v3: {},
                v4: { hidden: true },
              },
            }),
        })
      );

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError("Cannot find the latest version for v4");
    });

    it("should throw an error if no release match the specified version", async () => {
      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              tags: {
                v4: { release: "4.0.0" },
              },
              releases: {},
            }),
        })
      );

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError("Cannot find release for 4.0.0");
    });

    it("should throw an error if there's no compatible package", async () => {
      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
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
            }),
        })
      );

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError("Cannot find download package for Linux");
    });

    it("should throw an error if no release match the specified version", async () => {
      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() => Promise.reject(new Error("bad network")));

      await expect(async () => await getLatestCoreToolsRelease(4)).rejects.toThrowError(/bad network/);
    });
  });

  describe("getCoreToolsBinary", () => {
    it("should return the system binary if it's compatible", async () => {
      const execMock = jest.requireMock("child_process").exec;
      execMock.mockImplementationOnce((_cmd: string, cb: Function) => cb(null, { stdout: "4.0.0" }));

      const binary = await getCoreToolsBinary();
      expect(binary).toBe("func");
    });

    it("should return the downloaded binary if there's no system binary", async () => {
      const execMock = jest.requireMock("child_process").exec;
      execMock.mockImplementationOnce((_cmd: string, cb: Function) => cb({ stderr: "func does not exist" }));
      mockFs(
        {
          ["/home/user/.swa/core-tools/v4"]: { ".release-version": "4.3.2" },
        },
        { createTmp: false, createCwd: false }
      );

      const binary = await getCoreToolsBinary();

      // note: we have mocked os.platform(), so we can't check for os name!
      if (sep === "/") {
        expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
      } else {
        expect(binary).toContain(":\\home\\user\\.swa\\core-tools\\v4\\func");
      }
    });

    it("should return the downloaded binary if the system binary is incompatible", async () => {
      const execMock = jest.requireMock("child_process").exec;
      execMock.mockImplementationOnce((_cmd: string, cb: Function) => cb(null, { stdout: "3.0.0" }));
      mockFs(
        {
          ["/home/user/.swa/core-tools/v4"]: { ".release-version": "4.3.2" },
        },
        { createTmp: false, createCwd: false }
      );

      const binary = await getCoreToolsBinary();
      // note: we have mocked os.platform(), so we can't check for os name!
      if (sep === "/") {
        expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
      } else {
        expect(binary).toContain(":\\home\\user\\.swa\\core-tools\\v4\\func");
      }
    });

    // Note: this test blocks jest from exiting!
    it("should download core tools and return downloaded binary", async () => {
      const execMock = jest.requireMock("child_process").exec;
      execMock.mockImplementationOnce((_cmd: string, cb: Function) => cb({ stderr: "func does not exist" }));

      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
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
            }),
        })
      );
      const packageZip = Buffer.from("package");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          body: Readable.from(packageZip),
          headers: new HeadersMock({ "content-length": packageZip.length.toString() }),
        })
      );
      mockFs({ ["/home/user/.swa/core-tools/"]: {} }, { createTmp: false, createCwd: false });

      const binary = await getCoreToolsBinary();
      // note: we have mocked os.platform(), so we can't check for os name!
      if (sep === "/") {
        expect(binary).toBe("/home/user/.swa/core-tools/v4/func");
      } else {
        expect(binary).toContain(":\\home\\user\\.swa\\core-tools\\v4\\func");
      }
    });

    it("should return undefined if an error occured", async () => {
      const execMock = jest.requireMock("child_process").exec;
      execMock.mockImplementationOnce((_cmd: string, cb: Function) => cb({ stderr: "func does not exist" }));

      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() => Promise.reject({}));
      mockFs({}, { createTmp: false, createCwd: false });

      const binary = await getCoreToolsBinary();
      expect(binary).toBe(undefined);
    });
  });

  describe("downloadCoreTools", () => {
    // Note: this test blocks jest from exiting!
    it("should throw an error if the download is corrupted", async () => {
      const execMock = jest.requireMock("child_process").exec;
      execMock.mockImplementationOnce((_cmd: string, cb: Function) => cb({ stderr: "func does not exist" }));

      const fetchMock = jest.requireMock("node-fetch");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
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
            }),
        })
      );
      const packageZip = Buffer.from("package");
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          body: Readable.from(packageZip),
          headers: new HeadersMock({ "content-length": packageZip.length.toString() }),
        })
      );
      mockFs({ ["/home/user/.swa/core-tools/"]: {} }, { createTmp: false, createCwd: false });

      expect(async () => await downloadCoreTools(4)).rejects.toThrowError(/SHA2 mismatch/);
    });
  });
});
