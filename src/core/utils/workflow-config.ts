import fs from "fs";
import path from "path";
import YAML from "yaml";
import { DEFAULT_CONFIG } from "../../config";
import { detectRuntime, RuntimeType } from "../runtimes";
import { logger } from "./logger";
import { isHttpUrl } from "./net";
import { validateUserConfig } from "./user-config";

export const readWorkflowFile = ({ userConfig }: { userConfig?: Partial<GithubActionWorkflow> } = {}): Partial<GithubActionWorkflow> | undefined => {
  let isAppDevServer = false;
  let isApiDevServer = false;
  if (userConfig) {
    // is dev servers? Skip reading workflow file
    isAppDevServer = isHttpUrl(userConfig?.outputLocation!);
    isApiDevServer = isHttpUrl(userConfig?.apiLocation!);
    if (isAppDevServer && isApiDevServer) {
      return userConfig && validateUserConfig(userConfig);
    }
  }

  const infoMessage = `GitHub Actions configuration was not found under ".github/workflows/"`;
  const githubActionFolder = path.resolve(process.cwd(), ".github/workflows/");

  // does the config folder exist?
  if (fs.existsSync(githubActionFolder) === false) {
    logger.info(infoMessage);
    return userConfig && validateUserConfig(userConfig);
  }

  // find the SWA GitHub action file
  // TODO: handle multiple workflow files (see #32)
  let githubActionFile = fs
    .readdirSync(githubActionFolder)
    .filter((file) => file.includes("azure-static-web-apps") && file.endsWith(".yml"))
    .pop();

  // does the config file exist?
  if (!githubActionFile || fs.existsSync(githubActionFile)) {
    logger.info(infoMessage);
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
    output_location = DEFAULT_CONFIG.outputLocation,
    api_location = DEFAULT_CONFIG.apiLocation,
  } = swaBuildConfig.with;

  // the following locations (extracted from the config) should be under the user's project folder:
  // - app_location
  // - api_location
  // - output_location

  app_location = path.normalize(path.join(process.cwd(), app_location));
  if (typeof api_location !== "undefined") {
    api_location = path.normalize(path.join(process.cwd(), api_location || path.sep));
  }
  output_location = path.normalize(output_location);

  const detectedRuntimeType = detectRuntime(app_location);
  if (detectedRuntimeType === RuntimeType.dotnet) {
    // TODO: work out what runtime is being used for .NET rather than hard-coded
    output_location = path.join(app_location, "bin", "Debug", "netstandard2.1", "publish", output_location);
  } else {
    output_location = path.join(app_location, output_location);
  }

  // override SWA config with user's config (if provided):
  // if the user provides different app location, app artifact location or api location, use that information
  if (userConfig) {
    userConfig = validateUserConfig(userConfig);
    app_location = userConfig?.appLocation;
    output_location = userConfig?.outputLocation;
    api_location = userConfig?.apiLocation;
  }

  const files = isAppDevServer && isApiDevServer ? undefined : [githubActionFile];
  // convert variable names to camelCase
  // instead of snake_case
  const config: Partial<GithubActionWorkflow> = {
    appBuildCommand: isAppDevServer ? undefined : app_build_command,
    apiBuildCommand: isApiDevServer ? undefined : api_build_command,
    appLocation: app_location,
    apiLocation: api_location,
    outputLocation: output_location,
    files,
  };

  logger.silly({ config }, "swa");
  return config;
};
