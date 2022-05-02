import { detectProjectFolders, formatDetectedFolders, generateConfiguration } from "./detect";

describe("detectProjectFolders()", () => {
  it("should detect frameworks", async () => {
    const detectedFolders = await detectProjectFolders("e2e/fixtures");
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
    const config = await generateConfiguration(app[0], api[0]);
    expect(config).toEqual({
      apiBuildCommand: "cd e2e/fixtures/astro-node/node && npm run build --if-present",
      apiLocation: "e2e/fixtures/astro-node/node",
      appBuildCommand: "cd \"e2e/fixtures/astro-node/astro preact\" && npm run build",
      appLocation: ".",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:8080",
      name: "Astro, with API: Node.js",
      outputLocation: "e2e/fixtures/astro-node/astro preact/_site",
    });
  });

  it("should generate expected configuration for app static-node-ts", async () => {
    const { app, api } = await detectProjectFolders("e2e/fixtures/static-node-ts");
    const config = await generateConfiguration(app[0], api[0]);
    expect(config).toEqual({
      apiBuildCommand: "cd node-ts && npm run build --if-present",
      apiLocation: "node-ts/dist",
      appLocation: "e2e/fixtures/static-node-ts",
      name: "Static HTML, with API: Node.js, TypeScript",
      outputLocation: ".",
    });
  });
});
