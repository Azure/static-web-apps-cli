import { DEFAULT_CONFIG } from "../config.js";
import { DEFAULT_VERSION, SUPPORTED_VERSIONS } from "./constants.js";

describe("DEFAULT_CONFIG and DEFAULT_VERSION/SUPPORTED_VERSIONS consistency", () => {
  it("DEFAULT_CONFIG.apiVersion should match DEFAULT_VERSION.Node", () => {
    expect(DEFAULT_CONFIG.apiVersion).toBe(DEFAULT_VERSION.Node);
  });

  it("DEFAULT_CONFIG.apiLanguage should be 'node'", () => {
    expect(DEFAULT_CONFIG.apiLanguage).toBe("node");
  });

  it("every DEFAULT_VERSION should be in its corresponding SUPPORTED_VERSIONS", () => {
    expect(SUPPORTED_VERSIONS.Node).toContain(DEFAULT_VERSION.Node);
    expect(SUPPORTED_VERSIONS.Dotnet).toContain(DEFAULT_VERSION.Dotnet);
    expect(SUPPORTED_VERSIONS.DotnetIsolated).toContain(DEFAULT_VERSION.DotnetIsolated);
    expect(SUPPORTED_VERSIONS.Python).toContain(DEFAULT_VERSION.Python);
  });
});
