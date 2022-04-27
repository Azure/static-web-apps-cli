declare interface DetectionResult {
  app: DetectedFolder[];
  api: DetectedFolder[];
}

declare interface DetectedFolder {
  rootPath: string;
  frameworks: DetectedFramework[];
}

declare interface DetectedFramework extends FrameworkDefinition {
  rootPaths: string[];
}

declare interface FrameworkDefinition {
  id: string;
  name: string;
  // All config paths (ie appLocation, apiLocation, outputLocation)
  // can either be a path or an expression for looking into JSON files,
  // in the form: {<filename>#<expression>}
  // <expression> can use the "data" object to perform transforms & lookups
  // Example: {package.json#data.version} will return the version in package.json file.
  config: FrameworkConfig;
  // Should this framework override (ie remove) other framework ids in same root path?
  overrides?: string[];
  // Is this framework a variation of another framework id?
  parent?: string;
  // All files are mandatory, use globs if you need options
  files?: string[];
  // Search package.json for any dependencies or devDependencies
  packages?: string[];
  // For each filename specified as key, test if file contains specified string
  contains?: Record<string, string>;
}

declare type JsonData = Record<string, any>;
