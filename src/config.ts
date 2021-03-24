import path from "path";
export const DEFAULT_CONFIG: SWACLIConfig = {
  port: 4280,
  host: "0.0.0.0",
  apiPort: 7071,
  apiPrefix: "api",
  ssl: false,
  appLocation: `.${path.sep}`,
  appArtifactLocation: `.${path.sep}`,
  sslCert: undefined,
  sslKey: undefined,
  appBuildCommand: "npm run build --if-present",
  apiBuildCommand: "npm run build --if-present",
  swaConfigFilename: "staticwebapp.config.json",
  swaConfigFilenameLegacy: "routes.json",
};
