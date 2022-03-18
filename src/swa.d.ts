declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SWA_CLI_DEBUG: DebugFilterLevel;
      SWA_CLI_API_URI: string;
      SWA_CLI_APP_URI: string;
      SWA_CLI_OUTPUT_LOCATION: string;
      SWA_CLI_ROUTES_LOCATION: String;
      SWA_CLI_HOST: string;
      SWA_CLI_PORT: string;
      SWA_WORKFLOW_FILE: string;
      SWA_CLI_APP_SSL: boolean;
      SWA_CLI_APP_SSL_KEY: string;
      SWA_CLI_APP_SSL_CERT: string;
      SWA_CLI_STARTUP_COMMAND: string;
    }
  }
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
  swaConfigFilename?: "staticwebapp.config.json";
  swaConfigFilenameLegacy?: "routes.json";
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
};

declare type SWACLIDeployOptions = {
  appOutputLocation?: string;
  apiOutputLocation?: string;
  deploymentToken?: string;
};

declare type SWACLIConfig = SWACLIStartOptions & SWACLIDeployOptions & GithubActionWorkflow;

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
  configurations?: {
    [name: string]: SWACLIOptions & { context?: string };
  };
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
