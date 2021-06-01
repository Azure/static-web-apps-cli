jest.mock("./logger", () => {
  logger: {
    silly: jest.fn();
  }
});
import { validateCookie } from "./cookie";

describe("validateCookie()", () => {
  it("cookies = ''", () => {
    expect(validateCookie("")).toBe(false);
  });

  it("cookies = 'abc'", () => {
    expect(validateCookie("abc")).toBe(false);
  });

  it("cookies = 'foo=bar'", () => {
    expect(validateCookie("foo=bar")).toBe(false);
  });
});
