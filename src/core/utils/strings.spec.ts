import { dasherize, stripJsonComments, safeReadJson, safeReadFile } from "./strings";
import mockFs from "mock-fs";

describe("dasherize()", () => {
  it("should convert to dash case", () => {
    expect(dasherize("helloWorld")).toBe("hello-world");
    expect(dasherize("Hello World")).toBe("hello-world");
    expect(dasherize("Hello  World")).toBe("hello-world");
    expect(dasherize("hello_world")).toBe("hello-world");
    expect(dasherize("hello__world")).toBe("hello-world");
    expect(dasherize("helloWORLD")).toBe("hello-world");
    expect(dasherize("hello123World")).toBe("hello123-world");
  });
});

describe("stripJsonComments()", () => {
  it("should leave valid JSON untouched", () => {
    expect(stripJsonComments(`{
      "hello": "world"
    }`)).toBe(`{
      "hello": "world"
    }`);
  });

  it("should strip JSON comments", () => {
    expect(stripJsonComments(`{
      // this is a /* tricky comment
      "hello": "world",
      /* and this should be removed too // */
      "but": "not // this or /* this */ or /* this"
    }`)).toBe(`{
      
      "hello": "world",
      
      "but": "not // this or /* this */ or /* this"
    }`);
  });
});

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
