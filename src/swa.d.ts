declare global {
  declare namespace NodeJS {
    export interface ProcessEnv extends SWACLIEnv {}
  }
}

declare interface SWACLIEnv {
  DEBUG?: string; // general purpose debug variable
  SWA_CLI_DEBUG?: typeof DebugFilterLevel;
  SWA_RUNTIME_CONFIG_LOCATION?: string;
  SWA_RUNTIME_WORKFLOW_LOCATION?: string;

  // swa start
  SWA_CLI_API_PORT?: string;
  SWA_CLI_APP_LOCATION?: string;
  SWA_CLI_OUTPUT_LOCATION?: string;
  SWA_CLI_API_LOCATION?: string;
  SWA_CLI_HOST?: string;
  SWA_CLI_PORT?: string;
  SWA_CLI_APP_SSL?: "true" | "false";
  SWA_CLI_APP_SSL_CERT?: string;
  SWA_CLI_APP_SSL_KEY?: string;
  SWA_CLI_STARTUP_COMMAND?: string;
  SWA_CLI_DEVSERVER_TIMEOUT?: string;
  SWA_CLI_OPEN_BROWSER?: "true" | "false";

  // swa deploy
  SWA_CLI_DEPLOY_DRY_RUN?: string;
  SWA_CLI_DEPLOY_BINARY?: string;
  SWA_CLI_DEPLOY_BINARY_VERSION?: string;
  SWA_CLI_DEPLOYMENT_TOKEN?: string;
  SWA_RUNTIME_CONFIG?: string;
  SWA_CLI_VERSION?: string;

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
  VERBOSE?: "true" | "false";

  // swa login
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

declare type RuntimeHostConfig = {
  appPort: number;
  proxyHost: string;
  proxyPort: number;
  appLocation: string | undefined;
  outputLocation: string | undefined;
};

declare type GithubActionWorkflow = {
  appBuildCommand?: string;
  apiBuildCommand?: string;
  appLocation?: string;
  apiLocation?: string;
  outputLocation?: string;
  files?: string[];
};

declare type SWACLIStartOptions = {
  port?: number;
  host?: string;
  apiPort?: number;
  ssl?: boolean;
  apiPrefix?: "api";
  sslCert?: string;
  sslKey?: string;
  swaConfigFilename?: string;
  swaConfigFilenameLegacy?: string;
  app?: string;
  apiLocation?: string;
  build?: boolean;
  verbose?: string;
  run?: string;
  swaConfigLocation?: string;
  customUrlScheme?: string;
  overridableErrorCode?: number[];
  devserverTimeout?: number;
  funcArgs?: string;
  open?: boolean;
  config?: string;
  printConfig?: boolean;
  yes?: boolean;
  githubActionWorkflowLocation?: string;
};

declare type SWACLIDeployOptions = {
  outputLocation?: string;
  apiLocation?: string;
  deploymentToken?: string;
  dryRun?: boolean;
};

declare type SWACLIConfig = SWACLIStartOptions & SWACLILoginOptions & SWACLIDeployOptions & GithubActionWorkflow;

declare type SWACLILoginOptions = LoginDetails & {
  persist?: boolean;
  subscriptionId?: string;
  resourceGroupName?: string;
  appName?: string;
};

interface LoginDetails {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

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
    [name: string]: SWACLIOptions & { context?: string };
  };
};

declare type FrameworkConfig = GithubActionWorkflow & {
  name?: string;
  apiBuildCommand?: string;
  devServerCommand?: string;
  devServerUrl?: string;
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
