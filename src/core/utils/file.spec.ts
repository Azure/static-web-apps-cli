import mockFs from "mock-fs";
import { convertToNativePaths } from "../../jest.helpers.";
import { findUpPackageJsonDir, pathExists, safeReadFile, safeReadJson } from "./file";

describe("file utilities", () => {
  describe("safeReadJson()", () => {
    afterEach(() => {
      mockFs.restore();
    });

    it("should return undefined when trying to read an invalid JSON file", async () => {
      mockFs({ "test.json": "{ invalid json" });
      expect(await safeReadJson("test.json")).toBe(undefined);
    });

    it("should ignore JSON comments and parse JSON anyway", async () => {
      mockFs({
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
    afterEach(() => {
      mockFs.restore();
    });

    it("should return false if path doesn't exist", async () => {
      mockFs();
      expect(await pathExists("test.txt")).toBe(false);
    });

    it("should return true if path exists", async () => {
      mockFs({ "test.txt": "hello" });
      expect(await pathExists("test.txt")).toBe(true);
    });
  });

  describe("safeReadFile()", () => {
    afterEach(() => {
      mockFs.restore();
    });

    it("should return undefined when trying to read a file that doesn't exist", async () => {
      mockFs();
      expect(await safeReadFile("test.txt")).toBe(undefined);
    });

    it("should return file contents", async () => {
      mockFs({ "test.txt": "hello" });
      expect(await safeReadFile("test.txt")).toBe("hello");
    });
  });

  describe("findUpPackageJsonDir()", () => {
    afterEach(() => {
      mockFs.restore();
    });

    it("should return undefined if package.json is not found", async () => {
      mockFs();
      expect(await findUpPackageJsonDir("app", "dist")).toBe(undefined);
    });

    it("should return undefined if package.json is not found in path range", async () => {
      mockFs({ "package.json": "{}" });
      expect(await findUpPackageJsonDir("app", "dist")).toBe(undefined);
    });

    it("should return base path", async () => {
      mockFs({ [convertToNativePaths("app/package.json")]: "{}" });
      expect(await findUpPackageJsonDir(convertToNativePaths("app/"), "dist")).toBe("app");
    });

    it("should return start path", async () => {
      mockFs({ [convertToNativePaths("app/dist/package.json")]: "{}" });
      expect(await findUpPackageJsonDir("app", convertToNativePaths("dist/"))).toBe(convertToNativePaths("app/dist"));
    });

    it("should return the correct path", async () => {
      mockFs({ [convertToNativePaths("app/toto/package.json")]: "{}" });
      expect(await findUpPackageJsonDir("app", convertToNativePaths("toto/dist"))).toBe(convertToNativePaths("app/toto"));
    });
  });
});
