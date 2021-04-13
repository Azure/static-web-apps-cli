import { globToRegExp } from "./glob";

describe("globToRegExp()", () => {
  it("glob = <EMPTY>", () => {
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

  it("glob = /*.{jpg}", () => {
    expect(globToRegExp("/*.{jpg}")).toBe("\\/.*(jpg)");
  });

  it("glob = /*.{jpg,gif}", () => {
    expect(globToRegExp("/*.{jpg,gif}")).toBe("\\/.*(jpg|gif)");
  });

  it("glob = /foo/*.{jpg,gif}", () => {
    expect(globToRegExp("/foo/*.{jpg,gif}")).toBe("\\/foo\\/.*(jpg|gif)");
  });

  it("glob = {foo,bar}.json", () => {
    expect(globToRegExp("{foo,bar}.json")).toBe("(foo|bar).json");
  });
});
