import cookie from "cookie";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import shell from "shelljs";
import YAML from "yaml";

const response = ({ context, status, headers, cookies, body = "" }) => {
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

const validateCookie = (cookieValue: string) => {
  const cookies = cookie.parse(cookieValue);

  if (cookies.StaticWebAppsAuthCookie) {
    return cookies.StaticWebAppsAuthCookie === process.env.StaticWebAppsAuthCookie;
  }

  return false;
};

type SwaTokenResponse = {
  github: {
    client_id: string;
    client_secret: string;
  };
};

const ɵɵUseGithubDevToken = async () => {
  console.log("!!!! Notice: You are using a dev GitHub token. You should create and use your own!");
  console.log("!!!! Read https://docs.github.com/en/developers/apps/building-oauth-apps");
  const swaTokens = `https://gist.githubusercontent.com/manekinekko/7fbfc79a85b0f1f312715f1beda26236/raw/740c51aac5b1fb970e69408067a49907485d1e31/swa-emu.json`;
  const swaTokensResponse = await fetch(swaTokens);
  const token: SwaTokenResponse = await swaTokensResponse.json();
  return token.github;
};

export type Config = {
  app_build_command: string;
  api_build_command: string;
  app_location: string;
  app_artifact_location: string;
  api_location: string;
};

const readConfigFile = (): Config => {
  const githubActionFolder = path.resolve(process.cwd(), ".github/workflows/");

  // find the SWA GitHub action file
  let githubActionContent;
  try {
    let githubActionFile = fs
      .readdirSync(githubActionFolder)
      .filter((file) => file.includes("azure-static-web-apps") && file.endsWith(".yml"))
      .pop();

    githubActionFile = path.resolve(githubActionFolder, githubActionFile);

    githubActionContent = fs.readFileSync(githubActionFile, "utf8");
  } catch (err) {
    shell.echo("No SWA configuration build found. A SWA folder must contain a GitHub workflow file. Read more: https://bit.ly/31RAODu");
    shell.exit(0);
  }

  const swaYaml = YAML.parse(githubActionContent);
  const swaBuildConfig: { with: Config } = swaYaml.jobs.build_and_deploy_job.steps.find(
    (step) => step.uses && step.uses.includes("static-web-apps-deploy")
  );

  // extract the user's config and set defaults
  const {
    app_build_command = "npm run build --if-present",
    api_build_command = "npm run build --if-present",
    app_location = "/",
    app_artifact_location = "/",
    api_location = "api",
  } = swaBuildConfig.with;

  const config = {
    app_build_command,
    api_build_command,

    // these locations must be under the user's project folder
    app_location: path.join(process.cwd(), app_location),
    api_location: path.join(process.cwd(), api_location),
    app_artifact_location: path.join(process.cwd(), app_location, app_artifact_location),
  };

  return config;
};

export { response, validateCookie, ɵɵUseGithubDevToken, readConfigFile };
