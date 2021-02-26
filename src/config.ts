import path from "path";
export const DEFAULT_CONFIG: SWACLIConfig = {
  port: 4280,
  host: "0.0.0.0",
  authPort: 4242,
  apiPort: 7071,
  appPort: 4200,
  apiPrefix: "api",
  appLocation: `.${path.sep}`,
  appArtifactLocation: `.${path.sep}`,
  appBuildCommand: "npm run build --if-present",
  apiBuildCommand: "npm run build --if-present",
  swaConfigFilename: "staticwebapp.config.json",
  swaConfigFilenameLegacy: "routes.json",
};
