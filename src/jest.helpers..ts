import path from "path";
import os from "os";

const isWindows = /win/.test(os.platform());

// Deep convert any Windows path to Unix path in a string or object
export function convertToUnixPaths<T>(obj: T): T {
  if (!isWindows) {
    return obj;
  }

  if (typeof obj === "string") {
    return obj.replace(/\\\\?/g, "/") as any as T;
  } else if (Array.isArray(obj)) {
    return obj.map((value) => convertToUnixPaths(value)) as any as T;
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      (obj as any)[k] = convertToUnixPaths(v);
    }
  }
  return obj;
}

// Deep convert unix paths to native path in a string or object
export function convertToNativePaths<T>(obj: T): T {
  if (!isWindows) {
    return obj;
  }

  if (typeof obj === "string") {
    return /^https?:\/\//.test(obj) ? obj : (obj.replace(/\//g, path.sep) as any as T);
  } else if (Array.isArray(obj)) {
    return obj.map((value) => convertToNativePaths(value)) as any as T;
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      (obj as any)[k] = convertToNativePaths(v);
    }
  }
  return obj;
}
