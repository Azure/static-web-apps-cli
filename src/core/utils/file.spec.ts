import { fs, vol } from "memfs";
import { convertToNativePaths } from "../../test.helpers.js";
import { findUpPackageJsonDir, pathExists, safeReadFile, safeReadJson } from "./file.js";

vi.mock("node:fs");
vi.mock("node:fs/promises", async () => {
  const memfs: { fs: typeof fs } = await vi.importActual("memfs");
  return memfs.fs.promises;
});

describe("file utilities", () => {
  describe("safeReadJson()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("should return undefined when trying to read an invalid JSON file", async () => {
      vol.fromJSON({ "test.json": "{ invalid json" });
      expect(await safeReadJson("test.json")).toBe(undefined);
    });

    it("should ignore JSON comments and parse JSON anyway", async () => {
      vol.fromJSON({
        "test.json": `{
        // this is a /* tricky comment
        "hello": "world",
        /* and this should be removed too // */
        "but": "not // this or /* this */ or /* this"
      }`,
      });
      const json = await safeReadJson("test.json");
      expect(json && json.hello).toBe("world");
    });
  });

  describe("pathExists()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("should return false if path doesn't exist", async () => {
      expect(await pathExists("test.txt")).toBe(false);
    });

    it("should return true if path exists", async () => {
      vol.fromJSON({ "test.txt": "hello" });
      expect(await pathExists("test.txt")).toBe(true);
    });
  });

  describe("safeReadFile()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("should return undefined when trying to read a file that doesn't exist", async () => {
      expect(await safeReadFile("test.txt")).toBe(undefined);
    });

    it("should return file contents", async () => {
      vol.fromJSON({ "test.txt": "hello" });
      expect(await safeReadFile("test.txt")).toBe("hello");
    });
  });

  describe("findUpPackageJsonDir()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("should return undefined if package.json is not found", async () => {
      expect(await findUpPackageJsonDir("app", "dist")).toBe(undefined);
    });

    it("should return undefined if package.json is not found in path range", async () => {
      vol.fromJSON({ "package.json": "{}" });
      expect(await findUpPackageJsonDir("app", "dist")).toBe(undefined);
    });

    it("should return base path", async () => {
      vol.fromJSON({ [convertToNativePaths("app/package.json")]: "{}" });
      expect(await findUpPackageJsonDir(convertToNativePaths("app/"), "dist")).toBe("app");
    });

    it("should return start path", async () => {
      vol.fromJSON({ [convertToNativePaths("app/dist/package.json")]: "{}" });
      expect(await findUpPackageJsonDir("app", convertToNativePaths("dist/"))).toBe(convertToNativePaths("app/dist"));
    });

    it("should return the correct path", async () => {
      vol.fromJSON({ [convertToNativePaths("app/toto/package.json")]: "{}" });
      expect(await findUpPackageJsonDir("app", convertToNativePaths("toto/dist"))).toBe(convertToNativePaths("app/toto"));
    });
  });
});
