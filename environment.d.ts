declare global {
  namespace NodeJS {
    interface ProcessEnv {
      StaticWebAppsAuthCookie?: string;
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

export {};

declare interface RuntimeHostConfig {
  appPort: number;
  proxyHost: string;
  proxyPort: number;
  appLocation: string | undefined;
  appArtifactLocation: string | undefined;
};
