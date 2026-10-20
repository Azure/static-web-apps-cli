import { DEFAULT_CONFIG } from "../config.js";
import { DEFAULT_VERSION, SUPPORTED_VERSIONS } from "./constants.js";
import { getChoicesForApiLanguage, getDefaultVersion } from "./functions-versions.js";

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

describe(".NET runtime selection", () => {
  it("should offer .NET 10 isolated alongside the existing versions", () => {
    const choices = getChoicesForApiLanguage("dotnetisolated");

    expect(choices).toEqual([
      { title: "8.0", value: "8.0" },
      { title: "9.0", value: "9.0" },
      { title: "10.0", value: "10.0" },
    ]);
  });

  it.each(["dotnetisolated", "dotnet"])("should keep the %s default at .NET 8", (apiLanguage) => {
    const version = getDefaultVersion(apiLanguage);

    expect(version).toBe("8.0");
  });

  it("should not offer .NET 10 for the in-process runtime", () => {
    const choices = getChoicesForApiLanguage("dotnet");

    expect(choices).toEqual([{ title: "8.0", value: "8.0" }]);
  });
});
