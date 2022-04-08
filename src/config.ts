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
  SWA_RUNTIME_CONFIG_LOCATION,
  SWA_RUNTIME_WORKFLOW_LOCATION,
} = swaCLIEnv();

export const DEFAULT_CONFIG: SWACLIConfig = {
  // @public
  port: parseInt(SWA_CLI_PORT || "4280", 10),
  host: SWA_CLI_HOST || "localhost",
  apiPort: parseInt(SWA_CLI_API_PORT || "7071", 10),
  appLocation: SWA_CLI_APP_LOCATION || `.${path.sep}`,
  apiLocation: SWA_CLI_API_LOCATION || undefined,
  outputLocation: SWA_CLI_OUTPUT_LOCATION || `.${path.sep}`,
  swaConfigLocation: SWA_RUNTIME_CONFIG_LOCATION || `.${path.sep}`,
  ssl: SWA_CLI_APP_SSL === "true" || false,
  sslCert: SWA_CLI_APP_SSL_CERT || undefined,
  sslKey: SWA_CLI_APP_SSL_KEY || undefined,
  appBuildCommand: "npm run build --if-present",
  apiBuildCommand: "npm run build --if-present",
  run: undefined,
  verbose: "log",
  devserverTimeout: parseInt(SWA_CLI_DEVSERVER_TIMEOUT || "30000", 10),
  open: SWA_CLI_OPEN_BROWSER === "true" || false,
  githubActionWorkflowLocation: SWA_RUNTIME_WORKFLOW_LOCATION || undefined,

  // swa login options
  useKeychain: true,
  subscriptionId: undefined,
  resourceGroupName: undefined,
  tenantId: undefined,
  clientId: undefined,
  clientSecret: undefined,
  appName: undefined,
  dryRun: false,

  // TODO: these are constants, not configurable
  // they should be moved out of the config
  apiPrefix: "api",
  swaConfigFilename: "staticwebapp.config.json",
  swaConfigFilenameLegacy: "routes.json",
  customUrlScheme: "swa://",
  overridableErrorCode: [400, 401, 403, 404],
};
