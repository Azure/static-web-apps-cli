import os from "os";

export function isWSL() {
  return process.env.WSL_DISTRO_NAME !== undefined;
}

/**
 * Returns the os of the platform
 * @returns current os
 */
export function getPlatform(): "win-x64" | "osx-x64" | "linux-x64" | null {
  switch (os.platform()) {
    case "win32":
      return "win-x64";
    case "darwin":
      return "osx-x64";
    case "aix":
    case "freebsd":
    case "openbsd":
    case "sunos":
    case "linux":
      return "linux-x64";
    default:
      return null;
  }
}
