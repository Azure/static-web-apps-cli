import { logger } from "./logger";

jest.spyOn(logger, "silly").mockImplementation();
jest.mock("../constants", () => {});

import mockFs from "mock-fs";
import path from "path";
import { findSWAConfigFile, traverseFolder } from "./user-config";

describe("traverseFolder()", () => {
  afterEach(() => {
    mockFs.restore();
  });

  const asyncGeneratorToArray = async (gen: AsyncGenerator<string, string, unknown>) => {
    const entries: string[] = [];
    for await (const entry of gen) {
      entries.push(entry);
    }
    return entries;
  };

  it("should handle empty folders", async () => {
    mockFs();

    const entry = await asyncGeneratorToArray(traverseFolder("."));
    expect(entry).toEqual([]);
  });

  describe("should handle flat folder", async () => {
    it("with single entry", async () => {
      mockFs({
        "foo.txt": "fake content",
      });

      const entries = await asyncGeneratorToArray(traverseFolder("."));
      expect(entries.length).toBe(1);

      // entries are populated indeterminately because of async generator
      expect(entries.find((entry) => entry.endsWith("foo.txt"))).toEndWith("foo.txt");
    });

    it("with multiple entries", async () => {
      mockFs({
        "foo.txt": "fake content",
        "bar.jpg": "fake content",
      });

      const entries = await asyncGeneratorToArray(traverseFolder("."));
      expect(entries.length).toBe(2);

      // entries are populated indeterminately because of async generator
      expect(entries.find((entry) => entry.endsWith("bar.jpg"))).toEndWith("bar.jpg");
      expect(entries.find((entry) => entry.endsWith("foo.txt"))).toEndWith("foo.txt");
    });
  });

  describe("should handle deep folders", async () => {
    it("with single entry", async () => {
      mockFs({
        swa: {
          "foo.txt": "fake content",
        },
      });

      const entries = await asyncGeneratorToArray(traverseFolder("."));
      expect(entries.length).toBe(1);

      // entries are populated indeterminately because of async generator
      expect(entries.find((entry) => entry.endsWith(`swa${path.sep}foo.txt`))).toEndWith(`swa${path.sep}foo.txt`);
    });

    it("with multiple entries", async () => {
      mockFs({
        swa: {
          "foo.txt": "fake content",
        },
        "bar.jpg": "fake content",
      });

      const entries = await asyncGeneratorToArray(traverseFolder("."));
      expect(entries.length).toBe(2);

      // entries are populated indeterminately because of async generator
      expect(entries.find((entry) => entry.endsWith("bar.jpg"))).toEndWith("bar.jpg");
      expect(entries.find((entry) => entry.endsWith(`swa${path.sep}foo.txt`))).toEndWith(`swa${path.sep}foo.txt`);
    });
  });

  describe("should exclude folders", async () => {
    it("node_modules", async () => {
      mockFs({
        "foo.txt": "fake content",
        swa: {
          "bar.jpg": "fake content",
        },
        node_modules: {
          "bar.txt": "fake content",
        },
      });

      const entries = await asyncGeneratorToArray(traverseFolder("."));

      expect(entries.length).toBe(2);

      // entries are populated indeterminately because of async generator
      expect(entries.find((entry) => entry.endsWith(`swa${path.sep}bar.jpg`))).toEndWith(`swa${path.sep}bar.jpg`);
      expect(entries.find((entry) => entry.endsWith("foo.txt"))).toEndWith("foo.txt");
    });
  });
});

describe("findSWAConfigFile()", () => {
  afterEach(() => {
    mockFs.restore();
  });

  it("should find no config file", async () => {
    mockFs({});

    const file = await findSWAConfigFile(".");
    expect(file).toBe(null);
  });

  it("should find staticwebapp.config.json (at the root)", async () => {
    mockFs({
      "staticwebapp.config.json": `{ "routes": []}`,
    });

    const config = await findSWAConfigFile(".");
    expect(config?.file).toContain("staticwebapp.config.json");
  });

  it("should find staticwebapp.config.json (recursively)", async () => {
    mockFs({
      s: {
        w: {
          a: {
            "staticwebapp.config.json": `{ "routes": []}`,
          },
        },
      },
    });

    const config = await findSWAConfigFile(".");
    expect(config?.file).toContain("staticwebapp.config.json");
  });

  it("should find routes.json (at the root)", async () => {
    mockFs({
      "routes.json": `{ "routes": []}`,
    });

    const config = await findSWAConfigFile(".");
    expect(config?.file).toContain("routes.json");
  });

  it("should find routes.json (recursively)", async () => {
    mockFs({
      s: {
        w: {
          a: {
            "routes.json": `{ "routes": []}`,
          },
        },
      },
    });

    const config = await findSWAConfigFile(".");
    expect(config?.file).toContain("routes.json");
  });

  it("should ignore routes.json if a staticwebapp.config.json exists", async () => {
    mockFs({
      s: {
        w: {
          "staticwebapp.config.json": `{ "routes": []}`,
          a: {
            "routes.json": `{ "routes": []}`,
          },
        },
      },
    });

    const config = await findSWAConfigFile(".");
    expect(config?.file).toContain("staticwebapp.config.json");
  });
});
