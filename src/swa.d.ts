declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DEBUG: string;
      SWA_CLI_AUTH_URI: string;
      SWA_CLI_API_URI: string;
      SWA_CLI_APP_URI: string;
      SWA_CLI_APP_ARTIFACT_LOCATION: string;
      SWA_CLI_HOST: string;
      SWA_CLI_PORT: string;
    }
  }
}

declare type ServerRequest = IncomingMessage & {
  query: ParsedUrlQuery;
};
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
  appArtifactLocation: string | undefined;
};

declare type GithubActionSWAConfig = {
  appBuildCommand?: string;
  apiBuildCommand?: string;
  appLocation?: string;
  apiLocation?: string;
  appArtifactLocation?: string;
};

declare type SWACLIConfig = GithubActionSWAConfig & {
  port?: number;
  host?: string;
  authPort?: number;
  apiPort?: number;
  appPort?: number;
  apiPrefix?: "api";
};

declare interface CLIConfig extends SWACLIConfig {
  app?: string;
  api?: string;
  build?: boolean;
  verbose?: boolean;
}

declare type ResponseOptions = {
  [key: string]: any;
};
declare type ClientPrincipal = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
};
