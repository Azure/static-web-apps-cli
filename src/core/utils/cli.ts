import path from "path";
import fs from "fs";
import { logger } from "./logger";

/**
 * Parse process.argv and retrieve a specific flag value.
 * Usage:
 * ```
 * // ./server --port 4242
 * let port = argv<number>('--port');
 * ```
 *
 * @param flag the flag name to retrieve from argv, e.g.: --port
 * @returns {T} the value of the corresponding flag:
 * - if flag is --key=value or --key value, returns value as type `T`.
 * - if flag is --key, return a boolean (true if the flag is present, false if not).
 * - if flag is not present, return null.
 *
 */
export function argv<T extends string | number | boolean | null>(flag: string): T {
  const flags = process.argv;
  for (let index = 0; index < flags.length; index++) {
    const entry = flags[index];

    // ex: --key=value
    if (entry.startsWith("--")) {
      if (entry.includes("=")) {
        // ex: [--key, value]
        const [key, value] = entry.split("=");
        if (flag === key.trim()) {
          // ex: --key=value --> value
          // ex: --key=      --> null
          return (!!value ? value.trim() : null) as T;
        }
      }
      // ex: --key value
      // ex: --key
      else if (flag === entry.trim()) {
        const nextEntry = flags[index + 1]?.trim();
        // ex: --key
        if (nextEntry === undefined || nextEntry?.startsWith("--")) {
          return true as T;
        }
        // ex: --key value
        else if (!!nextEntry) {
          return nextEntry as T;
        }
      } else {
        // flag wasn't found
        return false as T;
      }
    }
  }

  return null as T;
}

/**
 * Registers a handler when process exits and executre a callback function.
 * @param callback The callback function to execute.
 */
export function registerProcessExit(callback: Function) {
  let terminated = false;

  const wrapper = () => {
    if (!terminated) {
      terminated = true;
      callback();
    }
  };

  process.on("SIGINT", wrapper);
  process.on("SIGTERM", wrapper);
  process.on("exit", wrapper);
}

/**
 * Parses and returns a valid script command line to be run before SWA starts. Also accepts shortcut npx, npm and yarn scripts in the form of npx:module, npm:script or yarn:script.
 * @param startupScript A file or npx/npm/yarn scripts to be exectued.
 * @param options The SWA CLI configuration flags.
 * @returns
 */
export function createStartupScriptCommand(startupScript: string, options: SWACLIConfig) {
  if (startupScript.includes(":")) {
    const [npmOrYarnBin, ...npmOrYarnScript] = startupScript.split(":");
    if (["npm", "yarn"].includes(npmOrYarnBin)) {
      return `${npmOrYarnBin} run ${npmOrYarnScript.join(":")} --if-present`;
    } else if (["npx"].includes(npmOrYarnBin)) {
      return `${npmOrYarnBin} ${npmOrYarnScript.join(":")}`;
    }
  } else {
    if (!path.isAbsolute(startupScript)) {
      const { appLocation } = options;
      const cwd = appLocation || process.cwd();
      const absoluteStartupScript = path.resolve(cwd, startupScript);
      if (fs.existsSync(absoluteStartupScript)) {
        startupScript = absoluteStartupScript;
      }
    }
    return startupScript;
  }
  return null;
}

/**
 * Parses the string devserver-timeout and returns an integer
 * @param time devserver-timeout flag as string
 * @returns parses the string and returns an integer
 */
export function parseServerTimeout(time: string) {
  // The argument 10 implies to convert the given string to base-10(decimal)
  const timeValue = parseInt(time, 10);
  if (isNaN(timeValue)) {
    logger.error(`--devserver-timeout should be a number expressed in seconds. Got "${time}".`, true);
  } else if (timeValue < 0) {
    logger.error(`--devserver-timeout should be a positive number`);
  }
  return timeValue;
}
