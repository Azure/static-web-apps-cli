import fs from "fs";
import path from "path";
import YAML from "yaml";
import { DEFAULT_CONFIG } from "../../config";
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

  logger.silly(`Trying to read workflow config with values:`);
  logger.silly(userWorkflowConfig!);

  if (userWorkflowConfig) {
    // is dev servers? Skip reading workflow file
    isAppDevServer = isHttpUrl(userWorkflowConfig?.outputLocation!);
    isApiDevServer = isHttpUrl(userWorkflowConfig?.apiLocation!);
    if (isAppDevServer && isApiDevServer) {
      logger.silly(`Detected dev server configuration`);

      return userWorkflowConfig;
    }
  }

  const githubActionFolder = path.resolve(userWorkflowConfig?.appLocation || process.cwd(), ".github/workflows/");

  // does the config folder exist?
  if (fs.existsSync(githubActionFolder) === false) {
    logger.silly(`No workflow config folder found at ${githubActionFolder}`);

    // no github actions folder found
    return userWorkflowConfig && validateUserWorkflowConfig(userWorkflowConfig);
  }

  // find the SWA GitHub action file
  // TODO: handle multiple workflow files (see #32)
  let githubActionFile = fs
    .readdirSync(githubActionFolder)
    .filter((file) => file.includes("azure-static-web-apps") && file.endsWith(".yml"))
    .pop();

  if (!githubActionFile) {
    logger.silly(`No SWA workflow config entry found under ${githubActionFolder}. Skipping`);

    // no SWA workflow file found
    return userWorkflowConfig && validateUserWorkflowConfig(userWorkflowConfig);
  }

  githubActionFile = path.resolve(githubActionFolder, githubActionFile!);

  // does the config file exist?
  if (fs.existsSync(githubActionFile!) === false) {
    logger.silly(`No workflow config file found at ${path.resolve(githubActionFile!)}. Skipping`);

    // no SWA workflow file found
    return userWorkflowConfig && validateUserWorkflowConfig(userWorkflowConfig);
  }

  logger.silly(`Found a SWA workflow file: ${githubActionFile}`);
  let githubActionContent = fs.readFileSync(githubActionFile, "utf8");

  if (typeof githubActionContent !== "string") {
    throw Error("TypeError: GitHub action file content should be a string");
  }

  // MOTE: the YAML library will parse and return properties as sanke_case
  // we will convert those properties to camelCase at the end of the function
  const swaYaml = YAML.parse(githubActionContent);

  if (!swaYaml) {
    throw Error(`could not parse the SWA workflow file "${githubActionFile}".`);
  }

  if (!swaYaml.jobs) {
    throw Error(`missing property "jobs" in the SWA workflow file "${githubActionFile}".`);
  }

  if (!swaYaml.jobs.build_and_deploy_job) {
    throw Error(`missing property "jobs.build_and_deploy_job" in the SWA workflow file "${githubActionFile}".`);
  }

  if (!swaYaml.jobs.build_and_deploy_job.steps) {
    throw Error(`missing property "jobs.build_and_deploy_job.steps" in the SWA workflow file "${githubActionFile}".`);
  }

  // hacking this to have an `any` on the type in .find, mainly because a typescript definition for the YAML file is painful...
  const swaBuildConfig = swaYaml.jobs.build_and_deploy_job.steps.find((step: any) => step.uses && step.uses.includes("static-web-apps-deploy"));

  if (!swaBuildConfig) {
    throw Error(`invalid property "jobs.build_and_deploy_job.steps[]" in the SWA workflow file "${githubActionFile}".`);
  }

  if (!swaBuildConfig.with) {
    throw Error(`missing property "jobs.build_and_deploy_job.steps[].with" in the SWA workflow file "${githubActionFile}".`);
  }

  // extract the user's config and set defaults
  let {
    app_build_command = userWorkflowConfig?.appBuildCommand || DEFAULT_CONFIG.appBuildCommand,
    api_build_command = userWorkflowConfig?.apiBuildCommand || DEFAULT_CONFIG.apiBuildCommand,
    app_location = userWorkflowConfig?.appLocation || DEFAULT_CONFIG.appLocation,
    output_location = userWorkflowConfig?.outputLocation || DEFAULT_CONFIG.outputLocation,
    api_location = userWorkflowConfig?.apiLocation || DEFAULT_CONFIG.apiLocation,
  } = swaBuildConfig.with;

  logger.silly({
    app_build_command,
    api_build_command,
    app_location,
    output_location,
    api_location,
  });

  // the following locations (extracted from the config) should be under the user's project folder:
  // - app_location
  // - api_location
  // - output_location

  app_location = path.normalize(path.join(process.cwd(), app_location));
  if (typeof api_location !== "undefined") {
    api_location = path.normalize(path.join(process.cwd(), api_location || path.sep));
  }
  output_location = path.normalize(output_location);
  output_location = path.join(app_location, output_location);

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

  logger.silly(`Workflow configuration:`);
  logger.silly({ config });
  return config;
}
