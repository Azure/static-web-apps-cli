const cookie = require("cookie");
const { default: fetch } = require("node-fetch");
const path = require("path");
const fs = require("fs");
const shell = require("shelljs");
const YAML = require("yaml");
const { detectRuntime, RuntimeType } = require("./runtimes");

module.exports.response = ({ context, status, headers, cookies, body = "" }) => {
  if (!context || !context.bindingData) {
    throw Error(
      "TypeError: context must be a valid Azure Functions context object. " +
        "See https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#context-object"
    );
  }

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

module.exports.validateCookie = (cookieValue) => {
  if (typeof cookieValue !== "string") {
    throw Error("TypeError: cookie value must be a string");
  }

  const cookies = cookie.parse(cookieValue);

  if (cookies.StaticWebAppsAuthCookie) {
    return cookies.StaticWebAppsAuthCookie === process.env.StaticWebAppsAuthCookie;
  }

  return false;
};

module.exports.getProviderFromCookie = (cookieValue) => {
  if (typeof cookieValue !== "string") {
    throw Error("TypeError: cookie value must be a string");
  }

  const cookies = cookie.parse(cookieValue);
  return cookies.StaticWebAppsAuthCookie__PROVIDER;
};

module.exports.ɵɵUseGithubDevToken = async () => {
  console.log("!!!! Notice: You are using a dev GitHub token. You should create and use your own!");
  console.log("!!!! Read https://docs.github.com/en/developers/apps/building-oauth-apps");
  const swaTokens = `https://gist.githubusercontent.com/manekinekko/7fbfc79a85b0f1f312715f1beda26236/raw/740c51aac5b1fb970e69408067a49907485d1e31/swa-emu.json`;
  const swaTokensResponse = await fetch(swaTokens);
  const token = await swaTokensResponse.json();
  return token.github;
};

module.exports.readConfigFile = () => {
  const githubActionFolder = path.resolve(process.cwd(), ".github/workflows/");

  // find the SWA GitHub action file
  let githubActionFile;
  let githubActionContent;
  try {
    githubActionFile = fs
      .readdirSync(githubActionFolder)
      .filter((file) => file.includes("azure-static-web-apps") && file.endsWith(".yml"))
      .pop();

    githubActionFile = path.resolve(githubActionFolder, githubActionFile);

    githubActionContent = fs.readFileSync(githubActionFile, "utf8");
  } catch (err) {
    shell.echo("No SWA configuration build found. A SWA folder must contain a GitHub workflow file. Read more: https://bit.ly/31RAODu");
    shell.exit(0);
  }

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

  const swaBuildConfig = swaYaml.jobs.build_and_deploy_job.steps.find((step) => step.uses && step.uses.includes("static-web-apps-deploy"));

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
  if (detectedRuntimeType === RuntimeType.node) {
    app_artifact_location = path.join(app_location, app_artifact_location);
  } else {
    app_artifact_location = path.join(app_location, "bin", "Debug", "netstandard2.1", "publish", app_artifact_location);
  }

  const config = {
    app_build_command,
    api_build_command,
    app_location,
    api_location,
    app_artifact_location,
  };

  return config;
};
