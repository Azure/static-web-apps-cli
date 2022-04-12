import path from "path";
import { swaCLIEnv } from "./core/env";
const {
  SWA_CLI_APP_LOCATION,
  SWA_CLI_API_LOCATION,
  SWA_CLI_DEVSERVER_TIMEOUT,
  SWA_CLI_OUTPUT_LOCATION,
  SWA_CLI_OPEN_BROWSER,
  SWA_CLI_APP_SSL,
  SWA_CLI_APP_SSL_KEY,
  SWA_CLI_APP_SSL_CERT,
  SWA_CLI_PORT,
  SWA_CLI_HOST,
  SWA_CLI_API_PORT,
  SWA_CLI_DEBUG,
  SWA_RUNTIME_CONFIG_LOCATION,
  SWA_RUNTIME_WORKFLOW_LOCATION,
  SWA_CLI_STARTUP_COMMAND,
  SWA_CLI_APP_BUILD_COMMAND,
  SWA_CLI_API_BUILD_COMMAND,
  SWA_CLI_LOGIN_USE_KEYCHAIN,
  AZURE_SUBSCRIPTION_ID,
  AZURE_RESOURCE_GROUP,
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SWA_CLI_APP_NAME,
  SWA_CLI_DEPLOY_DRY_RUN,
} = swaCLIEnv();

export const DEFAULT_CONFIG: SWACLIConfig = {
  // @public
  port: parseInt(SWA_CLI_PORT || "4280", 10),
  host: SWA_CLI_HOST || "localhost",
  apiPort: parseInt(SWA_CLI_API_PORT || "7071", 10),
  appLocation: SWA_CLI_APP_LOCATION || `.${path.sep}`,
  apiLocation: SWA_CLI_API_LOCATION ? SWA_CLI_API_LOCATION : undefined,
  outputLocation: SWA_CLI_OUTPUT_LOCATION || `.${path.sep}`,
  swaConfigLocation: SWA_RUNTIME_CONFIG_LOCATION || `.${path.sep}`,
  ssl: SWA_CLI_APP_SSL === "true" || false,
  sslCert: SWA_CLI_APP_SSL_CERT || undefined,
  sslKey: SWA_CLI_APP_SSL_KEY || undefined,
  appBuildCommand: SWA_CLI_APP_BUILD_COMMAND || "npm run build --if-present",
  apiBuildCommand: SWA_CLI_API_BUILD_COMMAND || "npm run build --if-present",
  run: SWA_CLI_STARTUP_COMMAND || undefined,
  verbose: SWA_CLI_DEBUG || "log",
  devserverTimeout: parseInt(SWA_CLI_DEVSERVER_TIMEOUT || "30000", 10),
  open: SWA_CLI_OPEN_BROWSER === "true" || false,
  githubActionWorkflowLocation: SWA_RUNTIME_WORKFLOW_LOCATION ? SWA_RUNTIME_WORKFLOW_LOCATION : undefined,

  // swa login options
  useKeychain: SWA_CLI_LOGIN_USE_KEYCHAIN === "true" ? true : false,
  subscriptionId: AZURE_SUBSCRIPTION_ID || undefined,
  resourceGroupName: AZURE_RESOURCE_GROUP || undefined,
  tenantId: AZURE_TENANT_ID || undefined,
  clientId: AZURE_CLIENT_ID || undefined,
  clientSecret: AZURE_CLIENT_SECRET || undefined,
  appName: SWA_CLI_APP_NAME || undefined,
  dryRun: SWA_CLI_DEPLOY_DRY_RUN === "true" || false,

  // TODO: these are constants, not configurable
  // they should be moved out of the config
  apiPrefix: "api",
  swaConfigFilename: "staticwebapp.config.json",
  swaConfigFilenameLegacy: "routes.json",
  customUrlScheme: "swa://",
  overridableErrorCode: [400, 401, 403, 404],
};
