import path from "node:path";
import os from "node:os";

const isWindows = /win/.test(os.platform());
type objectAsMap = { [key: string]: unknown };

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
    for (const [k, v] of Object.entries(obj as objectAsMap)) {
      (obj as objectAsMap)[k] = convertToUnixPaths(v);
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
    for (const [k, v] of Object.entries(obj as objectAsMap)) {
      (obj as objectAsMap)[k] = convertToNativePaths(v);
    }
  }
  return obj;
}
