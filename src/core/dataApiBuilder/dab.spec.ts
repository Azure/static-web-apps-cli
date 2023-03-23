import { DEFAULT_DATA_API_BUILDER_BINARY } from "../constants";
import { getDefaultDataApiBuilderBinaryForOS } from "./dab";

describe("getDefaultDataApiBuilderBinaryForOS", () => {
  it("returns the default binary for Windows when given win-x64 platform", () => {
    const platform = "win-x64";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.Windows;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });

  it("returns the default binary for macOS when given osx-x64 platform", () => {
    const platform = "osx-x64";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.MacOs;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });

  it("returns the default binary for Linux when given linux-x64 platform", () => {
    const platform = "linux-x64";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.Linux;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });

  it("returns the default binary for Windows when given an unsupported platform", () => {
    const platform = "foo-bar";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.Windows;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });
});
