import { getPlatform } from "./platform";
import os from "os";

describe("getPlatform", () => {
  it("should call os.platform() when getPlatform is called", () => {
    const mockOSPlatform = jest.spyOn(os, "platform").mockReturnValue("win32");

    getPlatform();

    expect(mockOSPlatform).toHaveBeenCalledTimes(1);
  });

  it("should return 'win-x64' when running on Windows", () => {
    // Mock the os.platform function to return "win32"
    jest.spyOn(os, "platform").mockReturnValue("win32");

    // Call the function and expect it to return "win-x64"
    expect(getPlatform()).toEqual("win-x64");
  });

  it("should return 'osx-x64' when running on macOS", () => {
    // Mock the os.platform function to return "darwin"
    jest.spyOn(os, "platform").mockReturnValue("darwin");

    // Call the function and expect it to return "osx-x64"
    expect(getPlatform()).toEqual("osx-x64");
  });

  it("should return 'linux-x64' when running on Linux", () => {
    // Mock the os.platform function to return "linux"
    jest.spyOn(os, "platform").mockReturnValue("linux");

    // Call the function and expect it to return "linux-x64"
    expect(getPlatform()).toEqual("linux-x64");
  });

  it("should return 'linux-x64' when running on Aix", () => {
    // Mock the os.platform function to return "linux"
    jest.spyOn(os, "platform").mockReturnValue("aix");

    // Call the function and expect it to return "linux-x64"
    expect(getPlatform()).toEqual("linux-x64");
  });

  it("should return 'linux-x64' when running on FreeBSD", () => {
    // Mock the os.platform function to return "linux"
    jest.spyOn(os, "platform").mockReturnValue("freebsd");

    // Call the function and expect it to return "linux-x64"
    expect(getPlatform()).toEqual("linux-x64");
  });

  it("should return 'linux-x64' when running on Sunos", () => {
    // Mock the os.platform function to return "linux"
    jest.spyOn(os, "platform").mockReturnValue("sunos");

    // Call the function and expect it to return "linux-x64"
    expect(getPlatform()).toEqual("linux-x64");
  });

  it("should return 'linux-x64' when running on OpenBSD", () => {
    // Mock the os.platform function to return "linux"
    jest.spyOn(os, "platform").mockReturnValue("openbsd");

    // Call the function and expect it to return "linux-x64"
    expect(getPlatform()).toEqual("linux-x64");
  });

  it("should return null when running on an unsupported platform", () => {
    // Mock the os.platform function to return "android"
    jest.spyOn(os, "platform").mockReturnValue("android");

    // Call the function and expect it to return null
    expect(getPlatform()).toBeNull();
  });
});
