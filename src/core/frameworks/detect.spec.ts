import { convertToUnixPaths } from "../../jest.helpers.";
import { detectProjectFolders, formatDetectedFolders, generateConfiguration } from "./detect";

describe("framework detection", () => {
  describe("detectProjectFolders()", () => {
    it("should detect frameworks", async () => {
      const detectedFolders = convertToUnixPaths(await detectProjectFolders("e2e/fixtures"));
      expect(detectedFolders.api.length).toBe(2);
      expect(detectedFolders.app.length).toBe(2);
      expect(formatDetectedFolders(detectedFolders.api, "api")).toMatchInlineSnapshot(`
        "Detected api folders (2):
        - e2e/fixtures/astro-node/node (Node.js)
        - e2e/fixtures/static-node-ts/node-ts (Node.js, TypeScript)"
      `);
      expect(formatDetectedFolders(detectedFolders.app, "app")).toMatchInlineSnapshot(`
        "Detected app folders (2):
        - e2e/fixtures/static-node-ts (Static HTML)
        - e2e/fixtures/astro-node/astro preact (Astro)"
      `);
    });
  });

  describe("generateConfiguration()", () => {
    it("should generate expected configuration for app astro-node", async () => {
      const { app, api } = await detectProjectFolders("e2e/fixtures/astro-node");
      const config = convertToUnixPaths(await generateConfiguration(app[0], api[0]));
      expect(config).toEqual({
        apiBuildCommand: "npm run build --if-present",
        apiLocation: "e2e/fixtures/astro-node/node",
        appBuildCommand: "npm run build",
        appLocation: "e2e/fixtures/astro-node/astro preact",
        appDevserverCommand: "npm run dev",
        appDevserverUrl: "http://localhost:8080",
        name: "Astro, with API: Node.js",
        outputLocation: "_site",
      });
    });

    it("should generate expected configuration for app static-node-ts", async () => {
      const { app, api } = await detectProjectFolders("e2e/fixtures/static-node-ts");
      const config = convertToUnixPaths(await generateConfiguration(app[0], api[0]));
      expect(config).toEqual({
        apiBuildCommand: "npm run build --if-present",
        apiLocation: "e2e/fixtures/static-node-ts/node-ts",
        appLocation: "e2e/fixtures/static-node-ts",
        name: "Static HTML, with API: Node.js, TypeScript",
        outputLocation: ".",
      });
    });
  });
});
