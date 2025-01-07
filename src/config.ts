import { useEnvVarOrUseDefault, swaCLIEnv } from "./core/env.js";
import { isRunningInDocker } from "./core/utils/docker.js";

const {
  SWA_CLI_APP_LOCATION,
  SWA_CLI_API_LOCATION,
  SWA_CLI_DATA_API_LOCATION,
  SWA_CLI_SERVER_TIMEOUT,
  SWA_CLI_OUTPUT_LOCATION,
  SWA_CLI_OPEN_BROWSER,
  SWA_CLI_APP_SSL,
  SWA_CLI_APP_SSL_KEY,
  SWA_CLI_APP_SSL_CERT,
  SWA_CLI_PORT,
  SWA_CLI_HOST,
  SWA_CLI_API_PORT,
  SWA_CLI_DATA_API_PORT,
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
  SWA_CLI_DEPLOY_ENV,
  SWA_CLI_LOGIN_CLEAR_CREDENTIALS,
  SWA_CLI_APP_DEVSERVER_URL,
  SWA_CLI_API_DEVSERVER_URL,
  SWA_CLI_DATA_API_DEVSERVER_URL,
  SWA_CLI_DATA_API_FOLDER,
  SWA_CLI_API_LANGUAGE,
  SWA_CLI_API_VERSION,
} = swaCLIEnv();

export const DEFAULT_CONFIG: SWACLIConfig = {
  // @public
  port: parseInt(SWA_CLI_PORT || "4280", 10),
  host: SWA_CLI_HOST || (isRunningInDocker() ? "0.0.0.0" : "localhost"),
  apiPort: parseInt(SWA_CLI_API_PORT || "7071", 10),
  dataApiPort: parseInt(SWA_CLI_DATA_API_PORT || "5000", 10),
  appLocation: SWA_CLI_APP_LOCATION || `.`,
  apiLocation: SWA_CLI_API_LOCATION ? SWA_CLI_API_LOCATION : undefined,
  dataApiLocation: SWA_CLI_DATA_API_LOCATION ? SWA_CLI_DATA_API_LOCATION : undefined,
  outputLocation: SWA_CLI_OUTPUT_LOCATION || `.`,
  swaConfigLocation: SWA_RUNTIME_CONFIG_LOCATION || undefined,
  ssl: useEnvVarOrUseDefault(SWA_CLI_APP_SSL, false),
  sslCert: SWA_CLI_APP_SSL_CERT || undefined,
  sslKey: SWA_CLI_APP_SSL_KEY || undefined,
  appBuildCommand: SWA_CLI_APP_BUILD_COMMAND || undefined,
  apiBuildCommand: SWA_CLI_API_BUILD_COMMAND || undefined,
  run: SWA_CLI_STARTUP_COMMAND || undefined,
  verbose: SWA_CLI_DEBUG || "log",
  devserverTimeout: parseInt(SWA_CLI_SERVER_TIMEOUT || "60", 10),
  open: useEnvVarOrUseDefault(SWA_CLI_OPEN_BROWSER, false),
  githubActionWorkflowLocation: SWA_RUNTIME_WORKFLOW_LOCATION ? SWA_RUNTIME_WORKFLOW_LOCATION : undefined,
  appDevserverUrl: SWA_CLI_APP_DEVSERVER_URL || undefined,
  apiDevserverUrl: SWA_CLI_API_DEVSERVER_URL || undefined,

  // swa deploy options
  env: SWA_CLI_DEPLOY_ENV || "preview",
  appName: SWA_CLI_APP_NAME || undefined,
  dryRun: useEnvVarOrUseDefault(SWA_CLI_DEPLOY_DRY_RUN, false),
  apiLanguage: SWA_CLI_API_LANGUAGE || "node",
  apiVersion: SWA_CLI_API_VERSION || "16",
  dataApiDevserverUrl: SWA_CLI_DATA_API_DEVSERVER_URL || undefined,

  // swa login options
  subscriptionId: AZURE_SUBSCRIPTION_ID || undefined,
  resourceGroup: AZURE_RESOURCE_GROUP || undefined,
  tenantId: AZURE_TENANT_ID || undefined,
  clientId: AZURE_CLIENT_ID || undefined,
  clientSecret: AZURE_CLIENT_SECRET || undefined,
  useKeychain: useEnvVarOrUseDefault(SWA_CLI_LOGIN_USE_KEYCHAIN, true),
  clearCredentials: useEnvVarOrUseDefault(SWA_CLI_LOGIN_CLEAR_CREDENTIALS, false),

  // swa db options
  folderName: SWA_CLI_DATA_API_FOLDER || "swa-db-connections",
};

export const getEnvVariablesForTelemetry = (): SWACLIEnv => {
  const { AZURE_SUBSCRIPTION_ID, SWA_CLI_VERSION } = swaCLIEnv();

  return {
    AZURE_SUBSCRIPTION_ID,
    SWA_CLI_VERSION,
  };
};
