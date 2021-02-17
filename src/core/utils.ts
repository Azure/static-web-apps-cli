import cookie from "cookie";
import fs from "fs";
import net from "net";
import path from "path";
import YAML from "yaml";
import { DEFAULT_CONFIG } from "../config";
import { detectRuntime, RuntimeType } from "./runtimes";
const { readdir } = require("fs").promises;

export const response = ({ context, status, headers, cookies, body = "" }: ResponseOptions) => {
  if (typeof status !== "number") {
    throw Error("TypeError: status code must be a number.");
  }

  let location;
  if (headers) {
    ({ location } = headers);
    headers = {
      ...headers,
      location: process.env.DEBUG ? null : location,
    };
  }

  body = body || null;
  if (process.env.DEBUG) {
    body =
      body ||
      JSON.stringify(
        {
          location,
          debug: {
            response: {
              cookies: {
                ...cookies,
              },
              headers: {
                ...headers,
              },
            },
            context: {
              ...context.bindingData,
            },
          },
        },
        null,
        2
      );
  }

  const res = {
    status,
    cookies,
    headers: {
      status,
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  };
  return res;
};

export const validateCookie = (cookieValue: string) => {
  if (typeof cookieValue !== "string") {
    throw Error(`TypeError: cookie value must be a string.`);
  }

  const cookies = cookie.parse(cookieValue);
  return !!cookies.StaticWebAppsAuthCookie;
};

export const serializeCookie = (cookieName: string, cookieValue: string, options: any) => {
  return cookie.serialize(cookieName, cookieValue, options);
};

export type SwaProviders = "aad" | "github" | "twitter" | "facebook" | "google";

export const decodeCookie = (cookieValue: any): ClientPrincipal | null => {
  const cookies = cookie.parse(cookieValue);
  if (cookies.StaticWebAppsAuthCookie) {
    const decodedValue = Buffer.from(cookies.StaticWebAppsAuthCookie, "base64").toString();
    return JSON.parse(decodedValue);
  }
  return null;
};

function validateUserConfig(userConfig: Partial<GithubActionSWAConfig>) {
  let appLocation = undefined;
  let apiLocation = undefined;
  let appArtifactLocation = undefined;

  if (userConfig.appLocation) {
    appLocation = path.normalize(path.join(process.cwd(), userConfig.appLocation || `.${path.sep}`));
    if (path.isAbsolute(userConfig.appLocation)) {
      appLocation = userConfig.appLocation;
    }
  }

  if (userConfig.apiLocation) {
    if (isHttpUrl(userConfig.apiLocation)) {
      apiLocation = userConfig.apiLocation;
    } else {
      // use the user's config and construct an absolute path
      apiLocation = path.normalize(path.join(process.cwd(), userConfig.apiLocation));
    }

    if (path.isAbsolute(userConfig.apiLocation)) {
      apiLocation = userConfig.apiLocation;
    }
  }

  if (userConfig.appArtifactLocation) {
    appArtifactLocation = path.normalize(path.join(process.cwd(), userConfig.appArtifactLocation || `.${path.sep}`));
    if (path.isAbsolute(userConfig.appArtifactLocation)) {
      appArtifactLocation = userConfig.appArtifactLocation;
    }
  }

  return {
    appLocation,
    apiLocation,
    appArtifactLocation,
  };
}

export const readConfigFile = ({ userConfig }: { userConfig?: Partial<GithubActionSWAConfig> } = {}): Partial<GithubActionSWAConfig> | undefined => {
  const infoMessage = `INFO: GitHub Actions configuration was not found under ".github/workflows/"`;
  const githubActionFolder = path.resolve(process.cwd(), ".github/workflows/");

  // does the config folder exist?
  if (fs.existsSync(githubActionFolder) === false) {
    console.info(infoMessage);
    return userConfig && validateUserConfig(userConfig);
  }

  // find the SWA GitHub action file
  // @TODO handle multiple config file
  let githubActionFile = fs
    .readdirSync(githubActionFolder)
    .filter((file) => file.includes("azure-static-web-apps") && file.endsWith(".yml"))
    .pop();

  // does the config file exist?
  if (!githubActionFile || fs.existsSync(githubActionFile)) {
    console.info(infoMessage);
    return userConfig && validateUserConfig(userConfig);
  }

  githubActionFile = path.resolve(githubActionFolder, githubActionFile);

  let githubActionContent = fs.readFileSync(githubActionFile, "utf8");

  if (typeof githubActionContent !== "string") {
    throw Error("TypeError: GitHub action file content should be a string");
  }

  // MOTE: the YAML library will parse and return properties as sanke_case
  // we will convert those properties to camelCase at the end of the function
  const swaYaml = YAML.parse(githubActionContent);

  if (!swaYaml) {
    throw Error(`could not parse the SWA workflow file "${githubActionFile}". Make sure it's a valid YAML file.`);
  }

  if (!swaYaml.jobs) {
    throw Error(`missing property 'jobs' in the SWA workflow file "${githubActionFile}". Make sure it's a valid SWA workflow file.`);
  }

  if (!swaYaml.jobs.build_and_deploy_job) {
    throw Error(
      `missing property 'jobs.build_and_deploy_job' in the SWA workflow file "${githubActionFile}". Make sure it's a valid SWA workflow file.`
    );
  }

  if (!swaYaml.jobs.build_and_deploy_job.steps) {
    throw Error(
      `missing property 'jobs.build_and_deploy_job.steps' in the SWA workflow file "${githubActionFile}". Make sure it's a valid SWA workflow file.`
    );
  }

  // hacking this to have an `any` on the type in .find, mainly because a typescript definition for the YAML file is painful...
  const swaBuildConfig = swaYaml.jobs.build_and_deploy_job.steps.find((step: any) => step.uses && step.uses.includes("static-web-apps-deploy"));

  if (!swaBuildConfig) {
    throw Error(
      `invalid property 'jobs.build_and_deploy_job.steps[]' in the SWA workflow file "${githubActionFile}". Make sure it's a valid SWA workflow file.`
    );
  }

  if (!swaBuildConfig.with) {
    throw Error(
      `missing property 'jobs.build_and_deploy_job.steps[].with' in the SWA workflow file "${githubActionFile}". Make sure it's a valid SWA workflow file.`
    );
  }

  // extract the user's config and set defaults
  let {
    app_build_command = DEFAULT_CONFIG.appBuildCommand,
    api_build_command = DEFAULT_CONFIG.apiBuildCommand,
    app_location = DEFAULT_CONFIG.appLocation,
    app_artifact_location = DEFAULT_CONFIG.appArtifactLocation,
    api_location = DEFAULT_CONFIG.apiLocation,
  } = swaBuildConfig.with;

  // the following locations (extracted from the config) should be under the user's project folder:
  // - app_location
  // - api_location
  // - app_artifact_location

  app_location = path.normalize(path.join(process.cwd(), app_location));
  if (typeof api_location !== "undefined") {
    api_location = path.normalize(path.join(process.cwd(), api_location || path.sep));
  }
  app_artifact_location = path.normalize(app_artifact_location);

  const detectedRuntimeType = detectRuntime(app_location);
  if (detectedRuntimeType === RuntimeType.dotnet) {
    // TODO: work out what runtime is being used for .NET rather than hard-coded
    app_artifact_location = path.join(app_location, "bin", "Debug", "netstandard2.1", "publish", app_artifact_location);
  } else {
    app_artifact_location = path.join(app_location, app_artifact_location);
  }

  // override SWA config with user's config (if provided):
  // if the user provides different app location, app artifact location or api location, use that information
  if (userConfig) {
    const { apiLocation, appArtifactLocation, appLocation } = validateUserConfig(userConfig);
    app_location = appLocation;
    app_artifact_location = appArtifactLocation;
    api_location = apiLocation;
  }

  // convert variable names to camelCase
  // instead of snake_case
  const config = {
    appBuildCommand: app_build_command,
    apiBuildCommand: api_build_command,
    appLocation: app_location,
    apiLocation: api_location,
    appArtifactLocation: app_artifact_location,
  };

  console.info(`INFO: Found SWA configuration file: ${githubActionFile}`);
  if (process.env.DEBUG) {
    console.info({ config });
  }
  return config;
};
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

export function isAcceptingTcpConnections({ host = "127.0.0.1", port }: { host?: string; port: number }) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection(port, host);

    socket
      .once("error", () => {
        resolve(false);
        socket.end();
      })
      .once("connect", () => {
        resolve(true);
        socket.end();
      });
  });
}

export function isHttpUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol.startsWith("http");
  } catch {
    return false;
  }
}

export async function validateDevServerConfig(context: string) {
  let { hostname, port } = parseUrl(context);

  try {
    const appListening = await isAcceptingTcpConnections({ port, host: hostname });
    if (appListening === false) {
      console.info(`INFO: Could not connect to "${context}". Is the server up and running?`);
      process.exit(0);
    } else {
      return context;
    }
  } catch (err) {
    if (err.message.includes("EACCES")) {
      console.info(`INFO: Port "${port}" cannot be used. You might need elevated or admin privileges. Or, use a valid port: 1024 to 49151.`);
    } else {
      console.error(err.message);
    }
    process.exit(0);
  }
}

export function parseUrl(url: string) {
  const { protocol, port, host, hostname } = new URL(url);
  return {
    protocol,
    port: Number(port),
    host,
    hostname,
  };
}

// @TODO
export function computeAppLocationFromArtifactLocation(appArtifactLocation: string | undefined) {
  if (appArtifactLocation) {
    return path.dirname(appArtifactLocation).split(path.sep).pop();
  }
  return undefined;
}

export function parsePort(port: string) {
  const portNumber = parseInt(port, 10);
  if (isNaN(portNumber)) {
    console.error(`Port "${port}" is not a number.`);
    process.exit(-1);
  } else {
    if (portNumber < 1024 || portNumber > 49151) {
      console.error(`Port "${port}" is out of range. Allowed ports are from 1024 to 49151.`);
      process.exit(-1);
    }
  }
  return portNumber;
}

async function* traverseFolder(folder: string): AsyncGenerator<string> {
  const folders = await readdir(folder, { withFileTypes: true });
  for (const folderEntry of folders) {
    const entryPath = path.resolve(folder, folderEntry.name);
    if (folderEntry.isDirectory()) {
      yield* traverseFolder(entryPath);
    } else {
      yield entryPath;
    }
  }
}

export async function findFile(folder: string, filePattern: RegExp) {
  for await (const file of traverseFolder(folder)) {
    const basename = path.basename(file);
    if (filePattern.test(basename)) {
      return file;
    }
  }
  return null;
}
