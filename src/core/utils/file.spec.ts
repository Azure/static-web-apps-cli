import mockFs from "mock-fs";
import { findUpPackageJsonDir, safeReadFile, safeReadJson } from "./file";

describe("safeReadJson()", () => {
  afterEach(() => {
    mockFs.restore();
  });

  it("should return undefined when trying to read an invalid JSON file", async () => {
    mockFs({ "test.json": "{ invalid json" });
    expect(await safeReadJson("test.json")).toBe(undefined);
  });

  it("should ignore JSON comments and parse JSON anyway", async () => {
    mockFs({ "test.json": `{
      // this is a /* tricky comment
      "hello": "world",
      /* and this should be removed too // */
      "but": "not // this or /* this */ or /* this"
    }`});
    const json = await safeReadJson("test.json");
    expect(json && json.hello).toBe("world");
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
    expect(await findUpPackageJsonDir('app', 'dist')).toBe(undefined);
  });

  it("should return undefined if package.json is not found in path range", async () => {
    mockFs({ 'package.json': '{}' });
    expect(await findUpPackageJsonDir('app', 'dist')).toBe(undefined);
  });

  it("should return base path", async () => {
    mockFs({ 'app/package.json': '{}' });
    expect(await findUpPackageJsonDir('app', 'dist')).toBe('app');
  });

  it("should return start path", async () => {
    mockFs({ 'app/dist/package.json': '{}' });
    expect(await findUpPackageJsonDir('app', 'dist')).toBe('app/dist');
  });

  it("should return the correct path", async () => {
    mockFs({ 'app/toto/package.json': '{}' });
    expect(await findUpPackageJsonDir('app', 'toto/dist')).toBe('app/toto');
  });
});

