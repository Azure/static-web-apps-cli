import { loadPackageJson } from "./json.js";

describe("json functions", () => {
  describe("loadPackageJson()", () => {
    it("loads package.json", () => {
      const pkg = loadPackageJson();
      expect(pkg).toHaveProperty("name");
      expect(pkg).toHaveProperty("version");
      expect(pkg.type).toBe("module");
    });
  });
});
