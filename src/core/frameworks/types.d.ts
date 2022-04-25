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
  // all config paths (ie appLocation, apiLocation, outputLocation)
  // can either be a path or an expression for looking into JSON files,
  // in the form: {<filename>#<expression>}
  // <expression> can use the "data" object to perform transforms & lookups
  // example: {package.json#data.version} will return the version in package.json file.
  config: FrameworkConfig;
  // should this framework preempt (ie remove) other framework ids?
  preempt?: string[];
  // is this framework a variation of another framework id?
  parent?: string;
  // all files are mandatory, use globs if you need options
  files?: string[];
  // search package.json for any dependencies or devDependencies
  packages?: string[];
}

declare type JsonData = Record<string, any>;
