import "../../../tests/_mocks/fs.js";
import { vol } from "memfs";
import path from "node:path";
import { MockInstance } from "vitest";
import { findSWAConfigFile, traverseFolder } from "./user-config.js";
import { logger } from "./logger.js";
import { convertToNativePaths } from "../../test.helpers.js";

const currentDir = "/a";

vi.spyOn(logger, "silly").mockImplementation(() => {});
vi.spyOn(logger, "warn").mockImplementation(() => {});

describe("userConfig", () => {
  describe("traverseFolder()", () => {
    let processSpy: MockInstance<(this: string) => string>;

    beforeEach(() => {
      processSpy = vi.spyOn(process, "cwd").mockReturnValue(convertToNativePaths(currentDir));
      vol.reset();
    });

    const asyncGeneratorToArray = async (gen: AsyncGenerator<string, string, unknown>) => {
      const entries: string[] = [];
      for await (const entry of gen) {
        entries.push(entry);
      }
      return entries;
    };

    it("should handle empty folders", async () => {
      vol.fromNestedJSON(
        {
          [convertToNativePaths(currentDir)]: {},
        },
        currentDir
      );
      const entry = await asyncGeneratorToArray(traverseFolder("."));
      expect(entry).toEqual([]);
    });

    describe("should handle flat folder", () => {
      it("with single entry", async () => {
        vol.fromJSON({
          "foo.txt": "fake content",
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(1);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith("foo.txt"))).toMatch(/foo\.txt$/);
      });

      it("with multiple entries", async () => {
        vol.fromJSON({
          "foo.txt": "fake content",
          "bar.jpg": "fake content",
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(2);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith("bar.jpg"))).toMatch(/bar\.jpg$/);
        expect(entries.find((entry) => entry.endsWith("foo.txt"))).toMatch(/foo\.txt$/);
      });
    });

    describe("should handle deep folders", () => {
      it("with single entry", async () => {
        vol.fromNestedJSON({
          swa: {
            "foo.txt": "fake content",
          },
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(1);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith(`swa${path.sep}foo.txt`))).toMatch(/foo\.txt$/);
      });

      it("with multiple entries", async () => {
        vol.fromNestedJSON({
          swa: {
            "foo.txt": "fake content",
          },
          "bar.jpg": "fake content",
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(2);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith("bar.jpg"))).toMatch(/bar\.jpg$/);
        expect(entries.find((entry) => entry.endsWith(`swa${path.sep}foo.txt`))).toMatch(/foo\.txt$/);
      });
    });

    describe("should exclude folders", () => {
      it("node_modules", async () => {
        vol.fromNestedJSON({
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
        expect(entries.find((entry) => entry.endsWith(`swa${path.sep}bar.jpg`))).toMatch(/bar\.jpg$/);
        expect(entries.find((entry) => entry.endsWith("foo.txt"))).toMatch(/foo\.txt$/);
      });
    });
  });

  describe("findSWAConfigFile()", () => {
    beforeEach(() => {
      vol.reset();
    });

    it("should find no config file", async () => {
      const file = await findSWAConfigFile(".");
      expect(file).toBe(null);
    });

    it("should find staticwebapp.config.json (recursively)", async () => {
      vol.fromNestedJSON({
        s: {
          w: {
            a: {
              "staticwebapp.config.json": `{ "routes": []}`,
            },
          },
        },
      });

      const config = await findSWAConfigFile(".");
      expect(config?.filepath).toContain("staticwebapp.config.json");
    });

    it("should warn if routes.json is found (root project)", async () => {
      vol.fromJSON({
        "routes.json": JSON.stringify({ routes: [] }),
      });

      const config = await findSWAConfigFile(".");
      expect(config).toBeNull();
      expect(logger.warn).toHaveBeenLastCalledWith(
        `   WARNING: Functionality defined in the routes.json file is now deprecated. File will be ignored!\n` +
          `   Read more: https://docs.microsoft.com/azure/static-web-apps/configuration#routes`
      );
    });

    it("should warn if routes.json is found (recursively)", async () => {
      vol.fromNestedJSON({
        s: {
          w: {
            a: {
              "routes.json": `{ "routes": []}`,
            },
          },
        },
      });

      const config = await findSWAConfigFile(".");
      expect(config).toBeNull();
      expect(logger.warn).toHaveBeenLastCalledWith(
        `   WARNING: Functionality defined in the routes.json file is now deprecated. File will be ignored!\n` +
          `   Read more: https://docs.microsoft.com/azure/static-web-apps/configuration#routes`
      );
    });

    it("should ignore routes.json if a staticwebapp.config.json exists", async () => {
      vol.fromNestedJSON({
        s: {
          w: {
            "staticwebapp.config.json": JSON.stringify({ routes: [] }),
            a: {
              "routes.json": JSON.stringify({ routes: [] }),
            },
          },
        },
      });

      const config = await findSWAConfigFile(".");
      expect(config?.filepath).toContain("staticwebapp.config.json");
    });
  });
});
