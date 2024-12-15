declare global {
  declare namespace NodeJS {
    export interface ProcessEnv extends SWACLIEnv {}
  }
}

declare module "json-source-map";
declare module "pem";

declare interface StaticSiteClientEnv {
  // StaticSitesClient env vars
  DEPLOYMENT_ACTION?: "close" | "upload";
  DEPLOYMENT_PROVIDER?: string;
  REPOSITORY_BASE?: string;
  SKIP_APP_BUILD?: "true";
  SKIP_API_BUILD?: "true";
  DEPLOYMENT_TOKEN?: string;
  APP_LOCATION?: string;
  OUTPUT_LOCATION?: string;
  API_LOCATION?: string;
  DATA_API_LOCATION?: string;
  VERBOSE?: string;
  DEPLOYMENT_ENVIRONMENT?: string;
  CONFIG_FILE_LOCATION?: string;
  FUNCTION_LANGUAGE?: string;
  FUNCTION_LANGUAGE_VERSION?: string;
}

declare interface SWACLIEnv extends StaticSiteClientEnv {
  DEBUG?: string; // general purpose debug variable
  SWA_CLI_DEBUG?: typeof DebugFilterLevel;
  SWA_RUNTIME_CONFIG_LOCATION?: string;
  SWA_CLI_CONFIG_LOCATION?: string;
  SWA_RUNTIME_WORKFLOW_LOCATION?: string;

  // swa start
  SWA_CLI_APP_LOCATION?: string;
  SWA_CLI_OUTPUT_LOCATION?: string;
  SWA_CLI_API_LOCATION?: string;
  SWA_CLI_DATA_API_LOCATION?: string;
  SWA_CLI_API_PORT?: string;
  SWA_CLI_DATA_API_PORT?: string;
  SWA_CLI_HOST?: string;
  SWA_CLI_PORT?: string;
  SWA_CLI_APP_SSL?: string;
  SWA_CLI_APP_SSL_CERT?: string;
  SWA_CLI_APP_SSL_KEY?: string;
  SWA_CLI_STARTUP_COMMAND?: string;
  SWA_CLI_SERVER_TIMEOUT?: string;
  SWA_CLI_OPEN_BROWSER?: string;
  SWA_CLI_APP_DEVSERVER_URL?: string;
  SWA_CLI_API_DEVSERVER_URL?: string;
  SWA_CLI_DATA_API_DEVSERVER_URL?: string;

  // swa deploy
  SWA_CLI_DEPLOY_DRY_RUN?: string;
  SWA_CLI_DEPLOY_BINARY?: string;
  SWA_CLI_DEPLOY_BINARY_VERSION?: string;
  SWA_CLI_DEPLOY_ENV?: string;
  SWA_CLI_DEPLOYMENT_TOKEN?: string;
  SWA_RUNTIME_CONFIG?: string;
  SWA_CLI_VERSION?: string;
  SWA_CLI_API_LANGUAGE?: string;
  SWA_CLI_API_VERSION?: string;
  AZURE_REGION_LOCATION?: string;

  // swa build
  SWA_CLI_APP_BUILD_COMMAND?: string;
  SWA_CLI_API_BUILD_COMMAND?: string;

  // swa login
  SWA_CLI_LOGIN_USE_KEYCHAIN?: string;
  SWA_CLI_LOGIN_CLEAR_CREDENTIALS?: string;

  // Azure AD
  AZURE_SUBSCRIPTION_ID?: string;
  AZURE_RESOURCE_GROUP?: string;
  SWA_CLI_APP_NAME?: string;
  AZURE_TENANT_ID?: string;
  AZURE_CLIENT_ID?: string;
  AZURE_CLIENT_SECRET?: string;

  // swa db
  SWA_CLI_DATA_API_FOLDER?: string;
}

declare interface Context {
  bindingData: undefined | { provider: string };
  invocationId?: string;
  res: {
    status?: number;
    cookies?: [
      {
        name: string;
        value: string;
        expires: string | Date;
        domaine: string;
      },
    ];
    headers?: { [key: string]: string };
    body?: { [key: string]: string } | string | null;
  };
}
declare interface Path {
  function: string;
  route: RegExp;
  method: "GET" | "POST";
}

declare type GithubActionWorkflow = {
  appBuildCommand?: string;
  apiBuildCommand?: string;
  appLocation?: string;
  apiLocation?: string;
  dataApiLocation?: string;
  outputLocation?: string;
  files?: string[];
};

// -- CLI Global options -----------------------------------------------------

declare type SWACLIGlobalOptions = {
  verbose?: string;
  config?: string;
  configName?: string;
  printConfig?: boolean;
};

// -- CLI Init options -------------------------------------------------------

declare type SWACLIInitOptions = {
  yes?: boolean;
};

// -- CLI Start options ------------------------------------------------------

declare type SWACLIStartOptions = {
  appLocation?: string;
  outputLocation?: string;
  apiLocation?: string;
  dataApiLocation?: string;
  appDevserverUrl?: string;
  apiDevserverUrl?: string;
  dataApiDevserverUrl?: string;
  dataApiPort?: number;
  apiPort?: number;
  host?: string;
  port?: number;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
  run?: string;
  devserverTimeout?: number;
  open?: boolean;
  funcArgs?: string;
  githubActionWorkflowLocation?: string;
  swaConfigLocation?: string;
};

// -- CLI Build options ------------------------------------------------------

declare type SWACLIBuildOptions = {
  appLocation?: string;
  apiLocation?: string;
  dataApiLocation?: string;
  outputLocation?: string;
  appBuildCommand?: string;
  apiBuildCommand?: string;
  auto?: boolean;
};

// -- CLI DB init options

declare type SWACLIDBInitOptions = {
  databaseType?: string;
  connectionString?: string;
  cosmosdb_nosqlDatabase?: string;
  cosmosdb_nosqlContainer?: string;
  folderName?: string;
};

// -- CLI Deploy options -----------------------------------------------------

declare type SWACLIDeployOptions = SWACLISharedLoginOptions & {
  apiLocation?: string;
  outputLocation?: string;
  dataApiLocation?: string;
  deploymentToken?: string;
  swaConfigLocation?: string;
  dryRun?: boolean;
  printToken?: boolean;
  env?: string;
  apiLanguage?: string;
  apiVersion?: string;
};

// -- CLI Login options ------------------------------------------------------

declare type LoginDetails = {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
};

declare type SWACLISharedLoginOptions = LoginDetails & {
  subscriptionId?: string;
  resourceGroup?: string;
  appName?: string;
  useKeychain?: boolean;
  clearCredentials?: boolean;
};

declare type SWACLILoginOptions = SWACLISharedLoginOptions;

// -- CLI Config options -----------------------------------------------------

declare type SWACLIConfig = SWACLIGlobalOptions &
  SWACLILoginOptions &
  SWACLIInitOptions &
  SWACLIBuildOptions &
  SWACLIStartOptions &
  SWACLIDeployOptions &
  SWACLIBuildOptions &
  SWACLIDBInitOptions & {
    login?: SWACLIGlobalOptions & SWACLILoginOptions;
    init?: SWACLIGlobalOptions & SWACLIInitOptions;
    start?: SWACLIGlobalOptions & SWACLIStartOptions;
    deploy?: SWACLIGlobalOptions & SWACLIDeployOptions;
    build?: SWACLIGlobalOptions & SWACLIBuildOptions;
    "db init"?: SWACLIGlobalOptions & SWACLIDBInitOptions;
  };

// Information about the loaded config
declare type SWACLIConfigInfo = {
  filePath: string;
  name: string;
  config: SWACLIConfig;
};

declare type ResponseOptions = {
  [key: string]: any;
};

declare type AuthContext = {
  authNonce: string;
  postLoginRedirectUri?: string;
};

declare type ClientPrincipal = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims?: Array<{ typ: string; val: string }>;
};

declare type SWAConfigFileRoute = {
  route: string;
  allowedRoles?: string[];
  statusCode?: number | string;
  serve?: string;
  headers?: SWAConfigFileRouteHeaders;
  methods?: string[];
  rewrite?: string;
  redirect?: string;
};

declare type SWAConfigFileGlobalHeaders = {
  [key: string]: string;
};

declare type SWAConfigFileRouteHeaders = {
  [key: string]: string;
};

declare type SWAConfigFileNavigationFallback = {
  rewrite: string;
  exclude?: string[];
};

declare type SWAConfigFileResponseOverrides = {
  [key: string]: {
    rewrite?: string;
    statusCode?: number;
    redirect?: string;
  };
};

declare type SWAConfigFileMimeTypes = {
  [key: string]: string;
};

declare type AuthIdentityTokenEndpoints = {
  [key: string]: {
    host: string;
    path: string;
  };
};

declare type AuthIdentityIssHosts = {
  [key: string]: string;
};

declare type AuthIdentityProvider = {
  registration: {
    [key: string]: string;
  };
};

declare type AuthIdentityRequiredFields = {
  [key: string]: string[];
};

declare type SWAConfigFileAuthIdenityProviders = {
  [key: string]: AuthIdentityProvider;
};

declare type SWAConfigFileAuth = {
  rolesSource?: string;
  identityProviders?: SWAConfigFileAuthIdenityProviders;
};

declare type SWAConfigFile = {
  routes: SWAConfigFileRoute[];
  navigationFallback: SWAConfigFileNavigationFallback;
  responseOverrides: SWAConfigFileResponseOverrides;
  globalHeaders: SWAConfigFileGlobalHeaders;
  mimeTypes: SWAConfigFileMimeTypes;
  isLegacyConfigFile: boolean;
  auth?: SWAConfigFileAuth;
};

declare type DebugFilterLevel = "silly" | "silent" | "log" | "info" | "error";

declare type SWACLIConfigFile = {
  $schema?: string;
  configurations?: {
    [name: string]: SWACLIOptions;
  };
};

declare type FrameworkConfig = GithubActionWorkflow & {
  name?: string;
  apiLanguage?: string;
  apiVersion?: string;
  apiBuildCommand?: string;
  appDevserverCommand?: string;
  appDevserverUrl?: string;
  apiDevserverUrl?: string;
};

declare interface CoreToolsRelease {
  version: string;
  url: string;
  sha2: string;
}

declare interface CoreToolsZipInfo {
  OS: string;
  Architecture: string;
  downloadLink: string;
  size: string;
  sha2: string;
}

declare type NpmPackageManager = "npm" | "yarn" | "pnpm";

declare type BinaryMetadata = {
  version: "stable" | "latest" | "old";
  files: {
    ["linux-x64"]: {
      url: string;
      sha: string;
    };
    ["win-x64"]: {
      url: string;
      sha: string;
    };
    ["osx-x64"]: {
      url: string;
      sha: string;
    };
  };
};

declare type StaticSiteClientReleaseMetadata = BinaryMetadata & {
  buildId: string;
  publishDate: string;
};

declare type DataApiBuilderReleaseMetadata = BinaryMetadata & {
  versionId: string;
  releaseType: string;
  releaseDate: string;
};

declare type LocalBinaryMetadata = {
  metadata: BinaryMetadata;
  binary: string;
  checksum: string;
};

declare type StaticSiteClientLocalMetadata = LocalBinaryMetadata;
declare type DataApiBuilderLocalMetadata = LocalBinaryMetadata;

const binaryType = {
  StaticSiteClient: 1,
  DataApiBuilder: 2,
};

declare type RolesSourceFunctionRequestBody = {
  identityProvider: string;
  userId?: string;
  userDetails?: string;
  claims?: RolesSourceClaim[];
  accessToken?: string;
};

declare type RolesSourceClaim = {
  typ: string;
  val: string;
};

declare type SubscriptionState = "Enabled" | "Warned" | "PastDue" | "Disabled" | "Deleted";

declare type AzureLoginInfo = {
  id: string;
  name: string;
  state: SubscriptionState;
  user: {
    name: string;
    type: string;
  };
  isDefault: boolean;
  tenantId: string;
  environmentName: string;
  homeTenantId: string;
  tenantDefaultDomain: string;
  tenantDisplayName: string;
  managedByTenants: string[];
};

declare interface AzureProfile {
  installationId: string;
  subscriptions: AzureLoginInfo[];
}
