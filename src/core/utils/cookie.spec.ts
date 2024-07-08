vi.mock("./logger", () => {
  logger: {
    silly: vi.fn();
  }
});
import { validateCookie } from "./cookie.js";

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
