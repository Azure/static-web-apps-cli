import "../../../tests/_mocks/fs.js";
vi.mock("../constants", () => {
  return {};
});
import path from "node:path";
import { vol } from "memfs";
import { argv, createStartupScriptCommand, parseServerTimeout } from "./cli.js";
import { logger } from "./logger.js";

describe("argv()", () => {
  it("process.argv = []", () => {
    process.argv = [];
    expect(argv("--port")).toBe(null);
  });

  it("process.argv = ['--port']", () => {
    process.argv = ["--port"];
    expect(argv("--port")).toBe(true);
    expect(argv("--portxyz")).toBe(false);
  });

  it("process.argv = ['--port=4242']", () => {
    process.argv = ["--port=4242"];
    expect(argv("--port")).toBe("4242");
  });

  it("process.argv = ['--port  =   4242  ']", () => {
    process.argv = ["--port  =  4242  "];
    expect(argv("--port")).toBe("4242");
  });

  it("process.argv = ['--port', '4242']", () => {
    process.argv = ["--port", "4242"];
    expect(argv("--port")).toBe("4242");
  });

  it("process.argv = ['--port', '--other']", () => {
    process.argv = ["--port", "--other"];
    expect(argv("--port")).toBe(true);
  });

  it("process.argv = ['--port=']", () => {
    process.argv = ["--port="];
    expect(argv("--port")).toBe(null);
  });
});

describe("createStartupScriptCommand()", () => {
  describe("npm", () => {
    it("should parse npm scripts (simple)", () => {
      const cmd = createStartupScriptCommand("npm:start", {});
      expect(cmd).toBe("npm run start --if-present");
    });
    it("should parse npm scripts (with -)", () => {
      const cmd = createStartupScriptCommand("npm:start-foo", {});
      expect(cmd).toBe("npm run start-foo --if-present");
    });
    it("should parse npm scripts (with :)", () => {
      const cmd = createStartupScriptCommand("npm:start:foo", {});
      expect(cmd).toBe("npm run start:foo --if-present");
    });
    it("should parse npm scripts (with #)", () => {
      const cmd = createStartupScriptCommand("npm:start#foo", {});
      expect(cmd).toBe("npm run start#foo --if-present");
    });
  });
  describe("yarn", () => {
    it("should parse yarn scripts (simple)", () => {
      const cmd = createStartupScriptCommand("yarn:start", {});
      expect(cmd).toBe("yarn run start --if-present");
    });
    it("should parse yarn scripts (with -)", () => {
      const cmd = createStartupScriptCommand("yarn:start-foo", {});
      expect(cmd).toBe("yarn run start-foo --if-present");
    });
    it("should parse yarn scripts (with :)", () => {
      const cmd = createStartupScriptCommand("yarn:start:foo", {});
      expect(cmd).toBe("yarn run start:foo --if-present");
    });
    it("should parse yarn scripts (with #)", () => {
      const cmd = createStartupScriptCommand("yarn:start#foo", {});
      expect(cmd).toBe("yarn run start#foo --if-present");
    });
  });
  describe("npx", () => {
    it("should parse npx command (simple)", () => {
      const cmd = createStartupScriptCommand("npx:foo", {});
      expect(cmd).toBe("npx foo");
    });
    it("should parse npx command (with -)", () => {
      const cmd = createStartupScriptCommand("npx:start-foo", {});
      expect(cmd).toBe("npx start-foo");
    });
    it("should parse npx command (with :)", () => {
      const cmd = createStartupScriptCommand("npx:start:foo", {});
      expect(cmd).toBe("npx start:foo");
    });
    it("should parse npx command (with #)", () => {
      const cmd = createStartupScriptCommand("npx:start#foo", {});
      expect(cmd).toBe("npx start#foo");
    });
  });
  describe("npm, npm and npx with optional args", () => {
    it("should parse npm options", () => {
      const cmd = createStartupScriptCommand("npm:foo --foo1 --foo2", {});
      expect(cmd).toBe("npm run foo --foo1 --foo2 --if-present");
    });
    it("should parse yarn options", () => {
      const cmd = createStartupScriptCommand("yarn:foo --foo1 --foo2", {});
      expect(cmd).toBe("yarn run foo --foo1 --foo2 --if-present");
    });
    it("should parse npx options", () => {
      const cmd = createStartupScriptCommand("npx:foo --foo1 --foo2", {});
      expect(cmd).toBe("npx foo --foo1 --foo2");
    });
  });
  describe("an external script", () => {
    beforeEach(() => {
      vol.reset();
    });
    it("should parse relative script file ./script.sh", () => {
      vol.fromJSON({
        "script.sh": "",
      });
      const cmd = createStartupScriptCommand("script.sh", {});
      expect(cmd).toBe(`${process.cwd()}${path.sep}script.sh`);
    });

    it("should parse relative script file ./script.sh from the root of --app-location", () => {
      vol.fromJSON({
        "/bar/script.sh": "",
      });
      const cmd = createStartupScriptCommand("script.sh", { appLocation: `${path.sep}bar` });
      expect(cmd).to.include(path.join(path.sep, "bar", "script.sh"));
    });

    it("should parse absolute script file /foo/script.sh", () => {
      vol.fromNestedJSON({
        "/foo": {
          "script.sh": "",
        },
      });
      const cmd = createStartupScriptCommand("/foo/script.sh", {});
      expect(cmd).toBe("/foo/script.sh");
    });
  });
  describe("custom command", () => {
    it("should return custom command", () => {
      const cmd = createStartupScriptCommand("dotnet watch run", {});
      expect(cmd).toBe("dotnet watch run");
    });
  });

  describe("parseServerTimeout()", () => {
    beforeEach(() => {
      vi.spyOn(logger, "error").mockImplementation(() => {
        return undefined as never;
      });
    });

    it("DevserverTimeout below 0 should be invalid", () => {
      parseServerTimeout("-10");
      expect(logger.error).toHaveBeenCalled();
    });

    it("DevserverTimeout for any positive value should be valid", () => {
      const timeValue = parseServerTimeout("30000");
      expect(timeValue).toBe(30000);
    });

    it("Non-number DevserverTimeout should be invalid", () => {
      parseServerTimeout("not a number");
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
