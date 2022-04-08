import { dasherize } from "./strings";

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
