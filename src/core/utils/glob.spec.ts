import { globToRegExp, isBalancedCurlyBrackets, isValidGlobExpression } from "./glob";

describe("glob functions", () => {
  describe("globToRegExp()", () => {
    it("glob = <empty>", () => {
      expect(globToRegExp("")).toBe("");
    });

    it("glob = abc", () => {
      expect(globToRegExp("abc")).toBe("abc");
    });

    it("glob = foo=bar", () => {
      expect(globToRegExp("foo=bar")).toBe("foo=bar");
    });

    it("glob = *", () => {
      expect(globToRegExp("*")).toBe("*");
    });
    it("glob = /*", () => {
      expect(globToRegExp("/*")).toBe("\\/.*");
    });

    it("glob = /foo/*", () => {
      expect(globToRegExp("/foo/*")).toBe("\\/foo\\/.*");
    });

    it("glob = /*.{ext}", () => {
      expect(globToRegExp("/*.{ext}")).toBe("\\/.*(ext)");
    });

    it("glob = /*.{ext,gif}", () => {
      expect(globToRegExp("/*.{ext,gif}")).toBe("\\/.*(ext|gif)");
    });

    it("glob = /foo/*.{ext,gif}", () => {
      expect(globToRegExp("/foo/*.{ext,gif}")).toBe("\\/foo\\/.*(ext|gif)");
    });

    it("glob = {foo,bar}.json", () => {
      expect(globToRegExp("{foo,bar}.json")).toBe("(foo|bar).json");
    });
  });

  // describe isValidGlobExpression

  describe("isValidGlobExpression()", () => {
    // valid expressions
    ["*", "/*", "/foo/*", "/foo/*.ext", "/*.ext", "*.ext", "/foo/*.ext", "/foo/*.{ext}", "/foo/*.{ext,ext}"].forEach((glob) => {
      describe("should be TRUE for the following values", () => {
        it(`glob = ${glob}`, () => {
          expect(isValidGlobExpression(glob)).toBe(true);
        });
      });
    });

    // invalid expressions
    [
      undefined,
      "",
      "*.*",
      "**.*",
      "**.**",
      "**",
      "*/*",
      "*/*.ext",
      "*.ext/*",
      "*/*.ext*",
      "*.ext/*.ext",
      "/blog/*/management",
      "/foo/*.{ext,,,,}",
      "/foo/*.{ext,",
      "/foo/*.ext,}",
      "/foo/*.ext}",
      "/foo/*.{}",
      "/foo/*.",
      "/foo/.",
    ].forEach((glob) => {
      describe("should be FALSE for the following values", () => {
        it(`glob = ${glob}`, () => {
          expect(isValidGlobExpression(glob)).toBe(false);
        });
      });
    });
  });

  describe("isBalancedCurlyBrackets()", () => {
    it("should be true for {}", () => {
      expect(isBalancedCurlyBrackets("{,,,}")).toBe(true);
    });

    it("should be true for {}{}{}", () => {
      expect(isBalancedCurlyBrackets("{,,,}{,,,}{,,,}")).toBe(true);
    });

    it("should be true for {{}}", () => {
      expect(isBalancedCurlyBrackets("{,,,{,,,},,,}")).toBe(true);
    });

    it("should be false for }{", () => {
      expect(isBalancedCurlyBrackets("},,,{")).toBe(false);
    });

    it("should be false for }{}{", () => {
      expect(isBalancedCurlyBrackets("},,,{,,,},,,{")).toBe(false);
    });

    it("should be false for {", () => {
      expect(isBalancedCurlyBrackets("{,,,")).toBe(false);
    });

    it("should be false for }", () => {
      expect(isBalancedCurlyBrackets(",,,}")).toBe(false);
    });

    it("should be false for {}}{{}", () => {
      expect(isBalancedCurlyBrackets("{,,,}},,,{{,,,}")).toBe(false);
    });
  });
});
