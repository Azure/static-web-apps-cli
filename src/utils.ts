import cookie from "cookie";
import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import YAML from "yaml";
import net from "net";
import { detectRuntime, RuntimeType } from "./runtimes";

type ResponseOptions = {
  [key: string]: any;
};
export type GithubActionSWAConfig = {
  appBuildCommand: string;
  apiBuildCommand: string;
  appLocation: string;
  apiLocation: string;
  appArtifactLocation: string;
};

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

  if (cookies.StaticWebAppsAuthCookie) {
    return cookies.StaticWebAppsAuthCookie === process.env.StaticWebAppsAuthCookie;
  }

  return false;
};

export const serializeCookie = (cookieName: string, cookieValue: string, options: any) => {
  return cookie.serialize(cookieName, cookieValue, options);
};

export type SwaProviders = "aad" | "github" | "twitter" | "facebook" | "google";
export const getProviderFromCookie = (cookieValue: any): SwaProviders => {
  if (typeof cookieValue !== "string") {
    throw Error("TypeError: cookie value must be a string");
  }

  const cookies = cookie.parse(cookieValue);
  return cookies.StaticWebAppsAuthCookie__PROVIDER as SwaProviders;
};

export const ɵɵUseGithubDevToken = async () => {
  console.log("!!!! Notice: You are using a dev GitHub token. You should create and use your own!");
  console.log("!!!! Read https://docs.github.com/en/developers/apps/building-oauth-apps");
  const swaTokens = `https://gist.githubusercontent.com/manekinekko/7fbfc79a85b0f1f312715f1beda26236/raw/740c51aac5b1fb970e69408067a49907485d1e31/swa-emu.json`;
  const swaTokensResponse = await fetch(swaTokens);
  const token = await swaTokensResponse.json();
  return token.github;
};

export const readConfigFile = ({ overrideConfig }: { overrideConfig?: Partial<GithubActionSWAConfig> } = {}):
  | Partial<GithubActionSWAConfig>
  | undefined => {
  const warningMessage = "WARNING: SWA configuration not found.";
  const githubActionFolder = path.resolve(process.cwd(), ".github/workflows/");

  if (fs.existsSync(githubActionFolder) === false) {
    console.warn(warningMessage);
    return {
      appLocation: path.normalize(path.join(process.cwd(), overrideConfig?.appLocation || `.${path.sep}`)),
      apiLocation: path.normalize(path.join(process.cwd(), overrideConfig?.apiLocation || `${path.sep}api`)),
      appArtifactLocation: path.normalize(path.join(process.cwd(), overrideConfig?.appArtifactLocation || `.${path.sep}`)),
    };
  }

  // find the SWA GitHub action file
  let githubActionFile = fs
    .readdirSync(githubActionFolder)
    .filter((file) => file.includes("azure-static-web-apps") && file.endsWith(".yml"))
    .pop();

  if (!githubActionFile || fs.existsSync(githubActionFile)) {
    console.warn(warningMessage);
    return overrideConfig;
  }

  githubActionFile = path.resolve(githubActionFolder, githubActionFile);

  let githubActionContent = fs.readFileSync(githubActionFile, "utf8");

  if (typeof githubActionContent !== "string") {
    throw Error("TypeError: GitHub action file content should be a string");
  }

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
    app_build_command = "npm run build --if-present",
    api_build_command = "npm run build --if-present",
    app_location = path.sep,
    app_artifact_location = path.sep,
    api_location = "api",
  } = swaBuildConfig.with;

  // the following locations must be under the user's project folder
  // - app_location
  // - api_location
  // - app_artifact_location

  app_location = path.normalize(path.join(process.cwd(), app_location));
  api_location = path.normalize(path.join(process.cwd(), api_location || path.sep));
  app_artifact_location = path.normalize(app_artifact_location);

  const detectedRuntimeType = detectRuntime(app_location);
  if (detectedRuntimeType === RuntimeType.dotnet) {
    // TODO: work out what runtime is being used for .NET rather than hard-coded
    app_artifact_location = path.join(app_location, "bin", "Debug", "netstandard2.1", "publish", app_artifact_location);
  } else {
    app_artifact_location = path.join(app_location, app_artifact_location);
  }

  // override SWA config with user's config (if provided)
  if (overrideConfig) {
    // if the user provides an app artifact location, use that information
    if (overrideConfig.appLocation) {
      app_location = path.normalize(path.join(process.cwd(), overrideConfig.appLocation));
    }

    // if the user provides an app artifact location, use that information
    // otherwise, try getting that information from the config file (if it's available)
    if (overrideConfig.appArtifactLocation) {
      app_artifact_location = path.normalize(path.join(process.cwd(), overrideConfig.appArtifactLocation));
    }

    // if the user provides an api location, use that information
    // otherwise, try getting that information from the config file (if it's available)
    if (overrideConfig.apiLocation) {
      api_location = path.normalize(path.join(process.cwd(), overrideConfig.apiLocation));
    }
  }

  const config = {
    appBuildCommand: app_build_command,
    apiBuildCommand: api_build_command,
    appLocation: app_location,
    apiLocation: api_location,
    appArtifactLocation: app_artifact_location,
  };

  console.info(`INFO: Using SWA configuration file: ${githubActionFile}`);
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
export async function isPortAvailable({ host = "127.0.0.1", port }: { host?: string; port: number }) {
  return new Promise<boolean>((resolve, reject) => {
    const server = net.createServer();

    server
      .once("error", (err: NodeJS.ErrnoException) => {
        if (err.code !== "EADDRINUSE") {
          reject(err);
        } else {
          resolve(false);
        }
      })
      .once("listening", () => {
        server.close();
        resolve(true);
      })
      .listen(port, host);
  });
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
