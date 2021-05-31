import fs from "fs";
import path from "path";
import YAML from "yaml";
import { DEFAULT_CONFIG } from "../../config";
import { detectRuntime, RuntimeType } from "../runtimes";
import { logger } from "./logger";
import { isHttpUrl } from "./net";
import { validateUserWorkflowConfig } from "./user-config";

/**
 * Read and parse the project workflow configuration (if available).
 * @param userWorkflowConfig An object containing GithubActionWorkflow configuration used to override the project workflow config (if available).
 * @returns The project workflow configuraiton.
 */
export function readWorkflowFile({ userWorkflowConfig }: { userWorkflowConfig?: Partial<GithubActionWorkflow> } = {}):
  | Partial<GithubActionWorkflow>
  | undefined {
  let isAppDevServer = false;
  let isApiDevServer = false;
  if (userWorkflowConfig) {
    // is dev servers? Skip reading workflow file
    isAppDevServer = isHttpUrl(userWorkflowConfig?.outputLocation!);
    isApiDevServer = isHttpUrl(userWorkflowConfig?.apiLocation!);
    if (isAppDevServer && isApiDevServer) {
      return userWorkflowConfig && validateUserWorkflowConfig(userWorkflowConfig);
    }
  }

  const githubActionFolder = path.resolve(process.cwd(), ".github/workflows/");

  // does the config folder exist?
  if (fs.existsSync(githubActionFolder) === false) {
    // no github actions folder found
    return userWorkflowConfig && validateUserWorkflowConfig(userWorkflowConfig);
  }

  // find the SWA GitHub action file
  // TODO: handle multiple workflow files (see #32)
  let githubActionFile = fs
    .readdirSync(githubActionFolder)
    .filter((file) => file.includes("azure-static-web-apps") && file.endsWith(".yml"))
    .pop();

  // does the config file exist?
  if (!githubActionFile || fs.existsSync(githubActionFile)) {
    // no SWA workflow file found
    return userWorkflowConfig && validateUserWorkflowConfig(userWorkflowConfig);
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
    throw Error(`could not parse the SWA workflow file "${githubActionFile}". Make sure it's a valid YAML file`);
  }

  if (!swaYaml.jobs) {
    throw Error(`missing property 'jobs' in the SWA workflow file "${githubActionFile}". Make sure it's a valid SWA workflow file`);
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
  if (userWorkflowConfig) {
    userWorkflowConfig = validateUserWorkflowConfig(userWorkflowConfig);
    app_location = userWorkflowConfig?.appLocation;
    output_location = userWorkflowConfig?.outputLocation;
    api_location = userWorkflowConfig?.apiLocation;
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
}
