import chalk from "chalk";
import cookie from "cookie";
import fs, { promises as fsPromises } from "fs";
import net from "net";
import path from "path";
import YAML from "yaml";
import { DEFAULT_CONFIG } from "../config";
import { detectRuntime, RuntimeType } from "./runtimes";

const { readdir, readFile } = fsPromises;

export const logger = {
  _print(prefix: string | null, data: string) {
    if (prefix) {
      console.log(chalk.dim.gray(`[${prefix}]`), data);
    } else {
      console.log(data);
    }
  },

  _traverseObjectProperties(o: any, fn: (_prop: string, _value: any, _indent: string) => void, indent = "") {
    for (const i in o) {
      if (o[i] !== null && typeof o[i] === "object") {
        fn(i, null, `${indent}`);
        this._traverseObjectProperties(o[i], fn, ` ${indent}`);
      } else {
        fn(i, o[i], ` ${indent}`);
      }
    }
  },

  // public methods
  info(data: string | object) {
    this.silly(data, null, "info");
  },

  log(data: string | object) {
    this.silly(data, null, "log");
  },

  error(data: string | object, exit = false) {
    const { SWA_CLI_DEBUG } = process.env;
    if (!SWA_CLI_DEBUG || SWA_CLI_DEBUG?.includes("silent")) {
      return;
    }

    console.error(chalk.red(data));
    if (exit) {
      process.exit(-1);
    }
  },

  silly(data: string | object, prefix: string | null = null, debugFilter: DebugFilterLevel = "silly") {
    const { SWA_CLI_DEBUG } = process.env;
    if (!SWA_CLI_DEBUG || SWA_CLI_DEBUG?.includes("silent")) {
      return;
    }

    if (SWA_CLI_DEBUG?.includes("silly") || SWA_CLI_DEBUG?.includes(debugFilter)) {
      if (typeof data === "object") {
        this._traverseObjectProperties(data, (key: string, value: string | null, indent: string) => {
          if (value !== null) {
            value = typeof value === "undefined" ? chalk.gray("<undefined>") : value;
            this._print(prefix, `${indent}- ${key}: ${chalk.green(value)}`);
          } else {
            this._print(prefix, `${indent}- ${key}:`);
          }
        });
      } else {
        // data is not an object so just print its value even if it's null or undefined
        this._print(prefix, data);
      }
    }
  },
};

export const response = ({ status, headers, cookies, body = "" }: ResponseOptions) => {
  if (typeof status !== "number") {
    throw Error("TypeError: status code must be a number.");
  }

  body = body || null;

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

function validateUserConfig(userConfig: Partial<GithubActionWorkflow>) {
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
    // is dev server url
    if (isHttpUrl(userConfig.appArtifactLocation)) {
      appArtifactLocation = userConfig.appArtifactLocation;
    } else {
      appArtifactLocation = path.normalize(path.join(process.cwd(), userConfig.appArtifactLocation || `.${path.sep}`));
      if (path.isAbsolute(userConfig.appArtifactLocation)) {
        appArtifactLocation = userConfig.appArtifactLocation;
      }
    }
  }

  return {
    appLocation,
    apiLocation,
    appArtifactLocation,
  };
}

export const readWorkflowFile = ({ userConfig }: { userConfig?: Partial<GithubActionWorkflow> } = {}): Partial<GithubActionWorkflow> | undefined => {
  const infoMessage = `INFO: GitHub Actions configuration was not found under ".github/workflows/"`;
  const githubActionFolder = path.resolve(process.cwd(), ".github/workflows/");

  // does the config folder exist?
  if (fs.existsSync(githubActionFolder) === false) {
    console.info(infoMessage);
    return userConfig && validateUserConfig(userConfig);
  }

  // find the SWA GitHub action file
  // TODO: handle multiple workflow files
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
  const files = [githubActionFile];
  const config: Partial<GithubActionWorkflow> = {
    appBuildCommand: app_build_command,
    apiBuildCommand: api_build_command,
    appLocation: app_location,
    apiLocation: api_location,
    appArtifactLocation: app_artifact_location,
    files,
  };

  process.env.SWA_WORKFLOW_CONFIG_FILE = githubActionFile;
  logger.silly({ config }, "utils");
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
      logger.error(`Could not connect to "${context}". Is the server up and running?`);
      process.exit(-1);
    } else {
      return context;
    }
  } catch (err) {
    if (err.message.includes("EACCES")) {
      logger.error(`Port "${port}" cannot be used. You might need elevated or admin privileges. Or, use a valid port: 1024 to 49151.`);
    } else {
      logger.error(err.message);
    }
    process.exit(-1);
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
    logger.error(`Port "${port}" is not a number.`, true);
  } else {
    if (portNumber < 1024 || portNumber > 49151) {
      logger.error(`Port "${port}" is out of range. Allowed ports are from 1024 to 49151.`, true);
    }
  }
  return portNumber;
}

export async function* traverseFolder(folder: string): AsyncGenerator<string> {
  const folders = (await readdir(folder, { withFileTypes: true })) as fs.Dirent[];
  for (const folderEntry of folders) {
    if (folderEntry.name.includes("node_modules")) {
      // ignore folder
      continue;
    }
    const entryPath = path.resolve(folder, folderEntry.name);
    if (folderEntry.isDirectory()) {
      yield* traverseFolder(entryPath);
    } else {
      yield entryPath;
    }
  }
}

export async function findSWAConfigFile(folder: string) {
  const configFiles = new Map<string, { file: string; isLegacyConfigFile: boolean }>();

  for await (const file of traverseFolder(folder)) {
    const filename = path.basename(file) as string;

    if (filename === DEFAULT_CONFIG.swaConfigFilename || filename === DEFAULT_CONFIG.swaConfigFilenameLegacy) {
      const config = JSON.parse((await readFile(file)).toString("utf-8"));

      // make sure we are using the right SWA config file.
      // Note: some JS frameworks (eg. Nuxt, Scully) use routes.json as part of their config. We need to ignore those
      const isValidSWAConfigFile = config.globalHeaders || config.mimeTypes || config.navigationFallback || config.responseOverrides || config.routes;
      if (isValidSWAConfigFile) {
        const isLegacyConfigFile = filename === DEFAULT_CONFIG.swaConfigFilenameLegacy;
        configFiles.set(filename, { file, isLegacyConfigFile });
      }
    }
  }

  // take staticwebapp.config.json if it exists (and ignore routes.json legacy file)
  if (configFiles.has(DEFAULT_CONFIG.swaConfigFilename!)) {
    return configFiles.get(DEFAULT_CONFIG.swaConfigFilename!);
  }
  // legacy config file
  else if (configFiles.has(DEFAULT_CONFIG.swaConfigFilenameLegacy!)) {
    return configFiles.get(DEFAULT_CONFIG.swaConfigFilenameLegacy!);
  }

  // no config file found
  return null;
}

export const address = (host: string, port: number | string | undefined) => {
  const protocol = `http`;
  if (!host) {
    throw new Error(`Host value is not set`);
  }

  let uri = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;

  try {
    new URL(uri);
  } catch (error) {
    throw new Error(`Address: ${uri} is malformed!`);
  }

  return uri;
};

export const registerProcessExit = (fn: Function) => {
  let terminated = false;

  const wrapper = () => {
    if (!terminated) {
      terminated = true;
      fn();
    }
  };

  process.on("SIGINT", wrapper);
  process.on("SIGTERM", wrapper);
  process.on("exit", wrapper);
};
