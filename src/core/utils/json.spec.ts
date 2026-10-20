import { loadPackageJson, validateConfigFile } from "./json.js";
import { logger } from "./logger.js";

describe("json functions", () => {
  describe("loadPackageJson()", () => {
    it("loads package.json", () => {
      const pkg = loadPackageJson();
      expect(pkg).toHaveProperty("name");
      expect(pkg).toHaveProperty("version");
      expect(pkg.type).toBe("module");
    });
  });

  describe("validateConfigFile() API runtimes", () => {
    it.each([
      "dotnet-isolated:10.0",
      "dotnet:8.0",
      "dotnet-isolated:8.0",
      "dotnet-isolated:9.0",
      "node:18",
      "node:20",
      "node:22",
      "python:3.9",
      "python:3.10",
      "python:3.11",
    ])("should accept %s", async (apiRuntime) => {
      const config = { platform: { apiRuntime } };

      const result = await validateConfigFile(config);

      expect(result).toEqual(config);
    });

    it("should reject .NET 10 for the in-process runtime", async () => {
      vi.spyOn(logger, "error").mockImplementation(() => {});
      const config = { platform: { apiRuntime: "dotnet:10.0" } };

      const result = await validateConfigFile(config);

      expect(result).toBeNull();
    });
  });
});
