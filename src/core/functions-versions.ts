import { DEFAULT_VERSION, SUPPORTED_VERSIONS } from "./constants.js";
import { logger } from "./utils/logger.js";

export function getDefaultVersion(apiLanguage: string): string {
  let apiVersion;
  // apiLanguage = apiLanguage.toLowerCase();
  switch (apiLanguage) {
    case "python":
      apiVersion = DEFAULT_VERSION.Python;
      break;
    case "dotnet":
      apiVersion = DEFAULT_VERSION.Dotnet;
      break;
    case "dotnetisolated":
      apiVersion = DEFAULT_VERSION.DotnetIsolated;
      break;
    case "node":
    default:
      apiVersion = DEFAULT_VERSION.Node;
      break;
  }
  return apiVersion;
}

export function getChoicesForApiLanguage(apiLanguage: string) {
  // Refer to this for functions and versions - https://learn.microsoft.com/azure/static-web-apps/configuration#selecting-the-api-language-runtime-version
  logger.silly(`ApiLang: ${apiLanguage}`);
  let choices = [];
  switch (apiLanguage) {
    case "python":
      choices = generateChoicesForApi(SUPPORTED_VERSIONS.Python);
      break;
    case "dotnet":
      choices = generateChoicesForApi(SUPPORTED_VERSIONS.Dotnet);
      break;
    case "dotnetisolated":
      choices = generateChoicesForApi(SUPPORTED_VERSIONS.DotnetIsolated);
      break;
    case "node":
    default:
      choices = generateChoicesForApi(SUPPORTED_VERSIONS.Node);
      break;
  }
  return choices;
}

/**
 * Generates and returns array of choices
 * @param supportedVersions
 * @returns array of choices
 */
function generateChoicesForApi(supportedVersions: string[]) {
  let choices = [];

  for (let index = 0; index < supportedVersions.length; index++) {
    const version = supportedVersions[index];
    const choice = {
      title: version,
      value: version,
    };
    choices.push(choice);
  }

  return choices;
}
