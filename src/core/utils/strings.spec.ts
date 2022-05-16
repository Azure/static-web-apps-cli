import { dasherize, hasSpaces, removeTrailingPathSep, stripJsonComments } from "./strings";

describe("string utilities", () => {
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
      expect(
        stripJsonComments(`{
        "hello": "world"
      }`)
      ).toBe(`{
        "hello": "world"
      }`);
    });

    it("should strip JSON comments", () => {
      expect(
        stripJsonComments(`{
        // this is a /* tricky comment
        "hello": "world",
        /* and this should be removed too // */
        "but": "not // this or /* this */ or /* this"
      }`)
      ).toBe(`{
        
        "hello": "world",
        
        "but": "not // this or /* this */ or /* this"
      }`);
    });
  });

  describe("removeTrailingPathSep()", () => {
    it("should leave path untouched", () => {
      expect(removeTrailingPathSep("./dir")).toBe("./dir");
    });

    it("should remove trailing slash", () => {
      expect(removeTrailingPathSep("./")).toBe(".");
    });

    it("should remove trailing anti-slash", () => {
      expect(removeTrailingPathSep("dir\\")).toBe("dir");
    });
  });

  describe("hasSpaces()", () => {
    it("should return false", () => {
      expect(hasSpaces("./dir")).toBe(false);
    });

    it("should return true", () => {
      expect(hasSpaces("c:\\my documents\\")).toBe(true);
    });
  });
});
