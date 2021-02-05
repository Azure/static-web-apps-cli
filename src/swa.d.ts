declare global {
  namespace NodeJS {
    interface ProcessEnv {
      StaticWebAppsAuthContextCookie: string;
      AppServiceAuthSession: string;
      DEBUG: string;
      GITHUB_CLIENT_ID: string;
      GITHUB_CLIENT_SECRET: string;
      SWA_EMU_AUTH_URI: string;
      SWA_EMU_API_URI: string;
      SWA_EMU_API_PREFIX: string;
      SWA_EMU_APP_URI: string;
      SWA_EMU_APP_ARTIFACT_LOCATION: string;
      SWA_EMU_HOST: string;
      SWA_EMU_PORT: string;
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
