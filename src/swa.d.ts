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
  VERBOSE?: string;
  DEPLOYMENT_ENVIRONMENT?: string;
  CONFIG_FILE_LOCATION?: string;
}

declare interface SWACLIEnv extends StaticSiteClientEnv {
  DEBUG?: string; // general purpose debug variable
  SWA_CLI_DEBUG?: typeof DebugFilterLevel;
  SWA_RUNTIME_CONFIG_LOCATION?: string;
  SWA_CLI_CONFIG_LOCATION?: string;
  SWA_RUNTIME_WORKFLOW_LOCATION?: string;

  // swa start
  SWA_CLI_API_PORT?: string;
  SWA_CLI_APP_LOCATION?: string;
  SWA_CLI_OUTPUT_LOCATION?: string;
  SWA_CLI_API_LOCATION?: string;
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

  // swa deploy
  SWA_CLI_DEPLOY_DRY_RUN?: string;
  SWA_CLI_DEPLOY_BINARY?: string;
  SWA_CLI_DEPLOY_BINARY_VERSION?: string;
  SWA_CLI_DEPLOY_ENV?: string;
  SWA_CLI_DEPLOYMENT_TOKEN?: string;
  SWA_RUNTIME_CONFIG?: string;
  SWA_CLI_VERSION?: string;
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
      }
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
  appDevserverUrl?: string;
  apiDevserverUrl?: string;
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
  outputLocation?: string;
  appBuildCommand?: string;
  apiBuildCommand?: string;
  auto?: boolean;
};

// -- CLI Deploy options -----------------------------------------------------

declare type SWACLIDeployOptions = SWACLISharedLoginOptions & {
  apiLocation?: string;
  outputLocation?: string;
  deploymentToken?: string;
  swaConfigLocation?: string;
  dryRun?: boolean;
  printToken?: boolean;
  env?: string;
};

// -- CLI Login options ------------------------------------------------------

declare type LoginDetails = {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
};

declare type SWACLISharedLoginOptions = LoginDetails & {
  subscriptionId?: string;
  resourceGroupName?: string;
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
  SWACLIBuildOptions & {
    login?: SWACLIGlobalOptions & SWACLILoginOptions;
    init?: SWACLIGlobalOptions & SWACLIInitOptions;
    start?: SWACLIGlobalOptions & SWACLIStartOptions;
    deploy?: SWACLIGlobalOptions & SWACLIDeployOptions;
    build?: SWACLIGlobalOptions & SWACLIBuildOptions;
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

declare type SWAConfigFile = {
  routes: SWAConfigFileRoute[];
  navigationFallback: SWAConfigFileNavigationFallback;
  responseOverrides: SWAConfigFileResponseOverrides;
  globalHeaders: SWAConfigFileGlobalHeaders;
  mimeTypes: SWAConfigFileMimeTypes;
  isLegacyConfigFile: boolean;
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
  apiBuildCommand?: string;
  appDevserverCommand?: string;
  appDevserverUrl?: string;
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
