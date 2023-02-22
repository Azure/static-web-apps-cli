import { DEFAULT_DOTNET_ISOLATED_VERSION, DEFAULT_DOTNET_VERSION, DEFAULT_NODE_VERSION, DEFAULT_PYTHON_VERSION } from "./constants";
import { logger } from "./utils/logger";

export function getDefaultVersion(apiLanguage: string | undefined): string {
  let apiVersion = "16";
  if (!apiLanguage) apiLanguage = "node";
  // apiLanguage = apiLanguage.toLowerCase();
  switch (apiLanguage) {
    case "node":
      apiVersion = DEFAULT_NODE_VERSION;
      break;
    case "python":
      apiVersion = DEFAULT_PYTHON_VERSION;
      break;
    case "dotnet":
      apiVersion = DEFAULT_DOTNET_VERSION;
      break;
    case "dotnetisolated":
      apiVersion = DEFAULT_DOTNET_ISOLATED_VERSION;
      break;
    default:
      apiVersion = DEFAULT_NODE_VERSION;
      break;
  }
  return apiVersion;
}

export function getChoicesForApiLanguage(apiLanguage: string) {
  // Refer to this for functions and versions - https://learn.microsoft.com/azure/static-web-apps/configuration#selecting-the-api-language-runtime-version
  logger.silly(`ApiLang: ${apiLanguage}`);
  let choices = [];
  switch (apiLanguage) {
    case "node":
      choices = [
        { title: "18", value: "18" },
        { title: "16", value: "16" },
        { title: "14", value: "14" },
        { title: "12", value: "12" },
      ];
      break;
    case "python":
      choices = [
        { title: "3.8", value: "3.8" },
        { title: "3.9", value: "3.9" },
        { title: "3.10", value: "3.10" },
      ];
      break;
    case "dotnet":
      choices = [
        { title: "6.0", value: "6.0" },
        { title: "3.1", value: "3.1" },
      ];
      break;
    case "dotnetisolated":
      choices = [
        { title: "6.0", value: "6.0" },
        { title: "7.0", value: "7.0" },
      ];
      break;
    default:
      choices = [
        { title: "18", value: "18" },
        { title: "16", value: "16" },
        { title: "14", value: "14" },
        { title: "12", value: "12" },
      ];
      break;
  }
  return choices;
}
