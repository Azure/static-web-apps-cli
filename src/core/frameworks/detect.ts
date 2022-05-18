import { promises as fs } from "fs";
import globrex from "globrex";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { hasSpaces, logger, removeTrailingPathSep, safeReadFile, safeReadJson } from "../utils";
import { apiFrameworks, appFrameworks } from "./frameworks";

const packageJsonFile = "package.json";

export async function generateConfiguration(app?: DetectedFolder, api?: DetectedFolder): Promise<FrameworkConfig> {
  let config: FrameworkConfig = {
    appLocation: DEFAULT_CONFIG.appLocation!,
    outputLocation: DEFAULT_CONFIG.outputLocation!,
  };

  if (!app && !api) {
    logger.silly("No known frameworks detected");
    return config;
  }

  let name = "";

  if (app) {
    name += `${app.frameworks.map((f) => f.name).join(", ")}`;
    app.frameworks.forEach((f) => (config = { ...config, ...f.config }));
    config.appLocation = await computePath(app.rootPath, config.appLocation);
    config.appLocation = removeTrailingPathSep(config.appLocation);
    config.outputLocation = await computePath(config.appLocation, config.outputLocation);
    config.outputLocation = path.normalize(path.relative(config.appLocation!, config.outputLocation));
    config.outputLocation = removeTrailingPathSep(config.outputLocation);
  }

  if (api) {
    name += name ? ", with " : "No app frameworks detected, ";
    name += `API: ${api.frameworks.map((f) => f.name).join(", ")}`;
    api.frameworks.forEach((f) => (config = { ...config, ...f.config }));

    const computedApiLocation = await computePath(api.rootPath, config.apiLocation);
    if (computedApiLocation !== api.rootPath) {
      // TODO: if someday SWA introduces an equivalent to outputLocation for the API
      // we should handle this here
      logger.silly(`Built API location "${computedApiLocation}" does not match root API location ${api.rootPath}, which is not supported yet`);
    }
    config.apiLocation = removeTrailingPathSep(api.rootPath);
  }

  const appRootPath = app && removeTrailingPathSep(app.rootPath);
  if (appRootPath && config.appBuildCommand && appRootPath !== config.appLocation) {
    // If the final app location is not the same as the detected root path of the app,
    // we need to adjust the build command to run in the correct path.
    let commandPath = path.relative(config.appLocation!, appRootPath);
    commandPath = hasSpaces(commandPath) ? `"${commandPath}"` : commandPath;
    config.appBuildCommand = `cd ${commandPath} && ${config.appBuildCommand}`;
  }

  const apiRootPath = api && removeTrailingPathSep(api.rootPath);
  if (apiRootPath && config.apiBuildCommand && apiRootPath !== config.apiLocation) {
    // If the final api location is not the same as the detected root path of the api,
    // we need to adjust the build command to run in the correct path.
    let commandPath = path.relative(config.apiLocation!, apiRootPath);
    commandPath = hasSpaces(commandPath) ? `"${commandPath}"` : commandPath;
    config.apiBuildCommand = `cd ${commandPath} && ${config.apiBuildCommand}`;
  }

  config.name = name;
  return config;
}

async function computePath(basePath: string, additionalPath?: string): Promise<string> {
  if (!additionalPath) {
    return basePath;
  }

  if (!additionalPath.startsWith("{")) {
    return path.join(basePath, additionalPath);
  }

  // Matches {<filename>#<expression>}, the first group is the filename, the second the expression
  const match = additionalPath.match(/^\{(.*?)#(.*?)\}$/);
  const [, filename, expression] = match || [];
  if (!filename || !expression) {
    throw new Error(`Invalid dynamic path format: ${additionalPath}`);
  }

  const files = await getFiles(basePath);
  const file = findFile(filename, files);
  if (!file) {
    throw new Error(`File "${filename}" not found in dynamic path: ${additionalPath}`);
  }

  const json = await safeReadJson(file);
  if (!json) {
    throw new Error(`Invalid JSON file: ${file}`);
  }

  const evaluateExpression = (json: JsonData, expr: string) => Function(`"use strict";return data => (${expr})`)()(json);

  try {
    const result = evaluateExpression(json, expression);
    if (result) {
      return path.join(basePath, result);
    }
  } catch (error) {
    const err = error as Error;
    logger.silly(err.stack || err.message);
    throw new Error(`Invalid expression "${expression}" in dynamic path: ${additionalPath}`);
  }

  return basePath;
}

export async function detectProjectFolders(projectPath: string = "."): Promise<DetectionResult> {
  const projectFiles = await getFiles(projectPath);
  const apiFrameworks = await detectApiFrameworks(projectFiles);
  const appFrameworks = await detectAppFrameworks(projectFiles);

  return {
    app: appFrameworks,
    api: apiFrameworks,
  };
}

export async function detectFrameworks(projectFiles: string[], frameworks: FrameworkDefinition[]): Promise<DetectedFolder[]> {
  // Here's how the detection heuristic works:
  // 1. Find possible roots for all frameworks based on files
  //    - All specified files must be matched
  //    - If a framework has a "packages" property, file "package.json" must be present
  //    - If a framework has a parent, all parent's files must be matched
  // 2. Filter frameworks by keeping only the ones that match packages
  //    - If any packages in the list is found in dependencies or devDependencies, it's a match
  // 3. Filter frameworks by keeping only the ones that pass their "contains" test
  //    - All files specified in "contains" must be present and contain the specified string
  // 4. Aggregate detection results by root path
  //    - Build a list of potential app root paths, with the list of frameworks found for each
  // 5. Filter out all root paths that are descendant of other root paths
  //    - Eliminate false-positives due to output/build artifacts or frameworks including example projects
  //      as part of their theming or docs, within the app folder
  // 6. Filter out frameworks in each root path based on overrides config
  //    - Clean up the list of frameworks, as some completely redefine the configuration and allow mix & match
  //      of multiple other frameworks under a specific build tool (Astro, for example)
  //    - Note that "static" framework will automatically be overriden by any other framework.
  // 7. Order frameworks in each root path based on parent-child relationships
  //    - As child frameworks may extend or override their parent's configuration, we need to make sure the
  //      parent's configuration is applied first

  const frameworksById: Record<string, DetectedFramework> = frameworks.reduce((acc, f) => ({ ...acc, [f.id]: f }), {});
  let detectedFrameworks: DetectedFramework[] = [];

  for (const framework of frameworks) {
    const files: string[] = [];
    // Parent files are implicit for child frameworks
    if (framework.parent) {
      const parent = frameworksById[framework.parent];
      files.push(...(parent.files ?? []), ...(parent.packages ? [packageJsonFile] : []));
    }
    files.push(...(framework.files ?? []), ...(framework.packages ? [packageJsonFile] : []));

    const rootPaths = await findRootPathsForFiles(files, projectFiles);
    if (rootPaths !== undefined) {
      detectedFrameworks.push({ ...framework, rootPaths });
    }
  }

  detectedFrameworks = await asyncFilter(
    detectedFrameworks,
    async (framework) => (await matchPackages(framework)) && (await matchContains(framework, projectFiles))
  );
  let detectedFolders = await aggregateFolders(detectedFrameworks);
  detectedFolders = filterDescendantFolders(detectedFolders);
  filterPreemptedFrameworks(detectedFolders);
  orderFrameworksByParent(detectedFolders);

  return detectedFolders;
}

async function detectApiFrameworks(projectFiles: string[]): Promise<DetectedFolder[]> {
  const detectedApiFolders: DetectedFolder[] = await detectFrameworks(projectFiles, apiFrameworks);
  logger.silly(formatDetectedFolders(detectedApiFolders, "api"));

  return detectedApiFolders;
}

async function detectAppFrameworks(projectFiles: string[]): Promise<DetectedFolder[]> {
  const detectedAppFolders: DetectedFolder[] = await detectFrameworks(projectFiles, appFrameworks);
  logger.silly(formatDetectedFolders(detectedAppFolders, "app"));

  return detectedAppFolders;
}

async function aggregateFolders(detectedFrameworks: DetectedFramework[]): Promise<DetectedFolder[]> {
  const stacks: Record<string, DetectedFramework[]> = {};
  for (const detectedFramework of detectedFrameworks) {
    for (const rootPath of detectedFramework.rootPaths) {
      if (!stacks[rootPath]) {
        stacks[rootPath] = [];
      }
      stacks[rootPath].push(detectedFramework);
    }
  }
  return Object.entries(stacks).map(([rootPath, frameworks]) => ({ rootPath, frameworks }));
}

async function matchPackages(framework: DetectedFramework): Promise<boolean> {
  if (!framework.packages) {
    return true;
  }

  const rootPathsMatches: string[] | undefined = await asyncFilter(framework.rootPaths, async (rootPath) => {
    const packageJsonPath = path.join(rootPath, packageJsonFile);
    const packageJson = await safeReadJson(packageJsonPath);
    if (!packageJson) {
      return false;
    }

    const dependencies = Object.keys(packageJson.dependencies ?? {});
    const devDependencies = Object.keys(packageJson.devDependencies ?? {});

    return framework.packages!.some((packageName) => dependencies.includes(packageName) || devDependencies.includes(packageName));
  });

  framework.rootPaths = rootPathsMatches;
  return rootPathsMatches.length > 0;
}

async function matchContains(framework: DetectedFramework, files: string[]): Promise<boolean> {
  if (!framework.contains) {
    return true;
  }

  const rootPathsMatches: string[] | undefined = await asyncFilter(framework.rootPaths, async (rootPath) => {
    const currentFiles = filesFromRootPath(rootPath, files);
    return asyncEvery(Object.entries(framework.contains!), async ([filename, stringToFind]) => {
      const file = findFile(filename, currentFiles);
      const content = await safeReadFile(file);

      if (!content) {
        return false;
      }
      return content.includes(stringToFind);
    });
  });

  framework.rootPaths = rootPathsMatches;
  return rootPathsMatches.length > 0;
}

export function isDescendantPath(testedPath: string, referencePath: string): boolean {
  return testedPath !== referencePath && !path.relative(referencePath, testedPath).startsWith("..");
}

function filterDescendantFolders(folders: DetectedFolder[]): DetectedFolder[] {
  // Find all folders that are descendants of other folders
  const descendantPaths: Set<string> = new Set();
  for (const folder of folders) {
    const descendantsFolders = folders.filter((f) => isDescendantPath(f.rootPath, folder.rootPath));
    descendantsFolders.forEach((f) => descendantPaths.add(f.rootPath));
  }

  if (descendantPaths.size === 0) {
    return folders;
  }

  logger.silly(`Found descendant folders to exclude:`);
  logger.silly(`- ${Array.from(descendantPaths).join("\n- ")}`);

  // Only keep folders that are not descendants
  return folders.filter((f) => !descendantPaths.has(f.rootPath));
}

function filterPreemptedFrameworks(detectedFolders: DetectedFolder[]): void {
  for (const folder of detectedFolders) {
    const overridenFrameworkIds: Set<string> = new Set();
    folder.frameworks.forEach((f) => {
      if (f.overrides) {
        f.overrides.forEach((id) => overridenFrameworkIds.add(id));
      }
    });

    // Static is special: if any other app framework is detected in a folder,
    // then static is automatically overriden
    if (folder.frameworks.length > 1) {
      overridenFrameworkIds.add("static");
    }

    if (overridenFrameworkIds.size === 0) {
      continue;
    }

    logger.silly(`Found frameworks to override in path ${folder.rootPath}: ${Array.from(overridenFrameworkIds).join(",")}`);

    folder.frameworks = folder.frameworks.filter((f) => !overridenFrameworkIds.has(f.id));
  }
}

function orderFrameworksByParent(detectedFolders: DetectedFolder[]): void {
  for (const folder of detectedFolders) {
    const { frameworks } = folder;
    const frameworkIndexById: Record<string, number> = {};
    let currentIndex = 0;

    // Make sure all parent frameworks are placed before their children, leave the rest untouched
    for (const framework of frameworks) {
      if (framework.parent && frameworkIndexById[framework.parent] === undefined) {
        // Whoops, parent must be placed before this framework!
        const parentIndex = frameworks.findIndex((f) => f.id === framework.parent);
        if (parentIndex === -1) {
          // Lonely childs should not be a thing
          logger.silly(`Framework ${framework.id} has parent ${framework.parent} but it's not detected`);
          frameworks.splice(currentIndex, 1);
          continue;
        }
        // Put the parent before this framework
        frameworks.splice(currentIndex, 0, frameworks.splice(parentIndex, 1)[0]);
        frameworkIndexById[framework.parent] = currentIndex++;
      }
      frameworkIndexById[framework.id] = currentIndex++;
    }
  }
}

function findAllFiles(fileglob: string, files: string[]): string[] {
  const { regex } = globrex(`?(*${path.sep})${fileglob}`, { extended: true, flags: "i" } as globrex.Options);
  return files.filter((file) => regex.test(file));
}

function findFile(fileglob: string, files: string[]): string | undefined {
  return findAllFiles(fileglob, files)[0];
}

function filesFromRootPath(rootPath: string, files: string[]): string[] {
  if (rootPath === "." || rootPath === `.${path.sep}`) {
    return files;
  }

  return files.filter((file) => file.startsWith(rootPath));
}

function findRootPathsForFiles(fileglobs: string[], files: string[]): string[] | undefined {
  const foundFiles = fileglobs.map((fileglob) => findAllFiles(fileglob, files));

  // Get possible root path from first glob matches
  // Note: currently it doesn't work if globs include subfolders
  // TODO: find common path denominator based on lowest dirname ancestor to try to find common root
  const uniqueRootPaths = new Set(foundFiles[0].map((file) => path.dirname(file)));
  const otherFoundFiles = foundFiles.slice(1);
  const possibleRootPaths = [...uniqueRootPaths].filter((p) => otherFoundFiles.every((files) => files.some((file) => path.dirname(file) === p)));

  return possibleRootPaths.length > 0 ? possibleRootPaths : undefined;
}

async function getFiles(rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      // Ignore dot files and node_modules
      if (entry.name.startsWith(".") || entry.name.includes("node_modules")) {
        return [];
      }
      const entryPath = path.join(rootPath, entry.name);
      return entry.isDirectory() ? [entryPath, ...(await getFiles(entryPath))] : [entryPath];
    })
  );
  return files.flat();
}

async function asyncFilter<T>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
  const results = await Promise.all(array.map(predicate));
  return array.filter((_, index) => results[index]);
}

async function asyncEvery<T>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<boolean> {
  const results = await Promise.all(array.map(predicate));
  return array.every((_, index) => results[index]);
}

export function printSupportedFrameworks(showList = false): void {
  if (showList) {
    logger.info(`Supported api frameworks: ${apiFrameworks.length}`);
    logger.info(`- ${apiFrameworks.map((f) => f.name).join("- \n")}`);
    logger.info(`Supported app frameworks: ${apiFrameworks.length}`);
    logger.info(`- ${appFrameworks.map((f) => f.name).join("- \n")}`);
  } else {
    logger.info(`Supported frameworks:`);
    logger.info(`- api: ${apiFrameworks.length}`);
    logger.info(`- app: ${appFrameworks.length}`);
  }
}

export function formatDetectedFolders(folders: DetectedFolder[], type: string): string {
  return (
    `Detected ${type} folders (${folders.length}):\n` +
    `- ${folders.map((f) => `${f.rootPath} (${f.frameworks.map((fr) => fr.name).join(", ")})`).join("\n- ")}`
  );
}
