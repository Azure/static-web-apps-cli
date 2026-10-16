import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface InternalExecutionSpec {
  executable: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Used only by the explicit Windows customer-shell adapter. */
  windowsVerbatimArguments?: boolean;
}

export interface ExecutableDirectoryExclusion {
  /** An exact search directory, not its descendants. */
  directory: string;
}

export type ExecutableExclusion = string | ExecutableDirectoryExclusion;

export interface ExecutableResolutionOptions {
  /** Strings exclude project trees; directory entries exclude only canonical search directories. */
  untrustedRoots?: readonly ExecutableExclusion[];
}

export class UnsupportedExecutableError extends Error {}

function platformPath() {
  return os.platform() === "win32" ? path.win32 : path;
}

function isAbsoluteExecutable(file: string): boolean {
  if (os.platform() === "win32") {
    // A rooted path without a drive still depends on the current drive.
    return /^[a-z]:[\\/]/i.test(file) || /^\\\\[^\\]+\\[^\\]+\\/.test(file);
  }
  return path.isAbsolute(file);
}

export function assertAbsoluteExecutable(file: string): void {
  if (!isAbsoluteExecutable(file)) {
    throw new Error(`Internal executable must be an absolute path: ${file}`);
  }
  if (/\.(?:cmd|bat|ps1)$/i.test(file)) {
    throw new UnsupportedExecutableError(
      `Command shims cannot be used as internal executables: ${file}. Use a native executable or a supported Node entrypoint.`,
    );
  }
}

function realPath(file: string): string | undefined {
  try {
    return fs.realpathSync(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

function containsPath(root: string, file: string): boolean {
  const paths = platformPath();
  // Conservative case folding also covers case-insensitive Unix volumes.
  const normalize = (value: string) =>
    paths
      .normalize(value)
      .replace(/^\\\\\?\\UNC\\/i, "\\\\")
      .replace(/^\\\\\?\\([a-z]:\\)/i, "$1")
      .toLowerCase();
  const relative = paths.relative(normalize(root), normalize(file));
  return relative === "" || (!relative.startsWith(`..${paths.sep}`) && relative !== ".." && !paths.isAbsolute(relative));
}

function samePath(first: string, second: string): boolean {
  return containsPath(first, second) && containsPath(second, first);
}

function matchesDirectory(directory: string, exclusion: ExecutableDirectoryExclusion): boolean {
  const root = platformPath().resolve(exclusion.directory);
  return samePath(root, directory) || samePath(realPath(root) ?? root, directory);
}

function excludedPath(file: string, options: ExecutableResolutionOptions): boolean {
  const paths = platformPath();
  const entries = options.untrustedRoots ?? [];
  const roots = entries.filter((entry): entry is string => typeof entry === "string").map((root) => paths.resolve(root));
  const cwd = paths.resolve(process.cwd());
  // Legacy callers assume cwd is their project. Explicit contexts classify it without that assumption.
  if (!entries.some((entry) => typeof entry !== "string" && matchesDirectory(cwd, entry))) roots.push(cwd);
  return roots.some((root) => containsPath(root, file) || containsPath(realPath(root) ?? root, file));
}

function excludedSearchDirectory(directory: string, options: ExecutableResolutionOptions): boolean {
  return (options.untrustedRoots ?? []).some((entry) => typeof entry !== "string" && matchesDirectory(directory, entry));
}

function trustedPath(file: string, options: ExecutableResolutionOptions): string | undefined {
  if (!isAbsoluteExecutable(file)) return undefined;
  if (excludedPath(file, options)) return undefined;

  let canonical: string | undefined;
  try {
    canonical = realPath(file);
  } catch (error) {
    // An inaccessible PATH candidate cannot be selected; other absolute entries may still be usable.
    if ((error as NodeJS.ErrnoException).code === "EACCES") return undefined;
    throw error;
  }
  if (!canonical || !isAbsoluteExecutable(canonical)) return undefined;
  if (excludedPath(canonical, options)) return undefined;
  return canonical;
}

/** Bind a managed path even before download, while checking existing parent-directory aliases. */
export function resolveManagedExecutable(file: string, options: ExecutableResolutionOptions = {}): string {
  assertAbsoluteExecutable(file);
  const paths = platformPath();
  const suffix: string[] = [];
  let parent = file;
  let canonical = realPath(parent);
  while (!canonical) {
    const next = paths.dirname(parent);
    if (next === parent) throw new Error(`Cannot resolve managed executable directory: ${file}`);
    suffix.unshift(paths.basename(parent));
    parent = next;
    canonical = realPath(parent);
  }
  const resolved = paths.join(canonical, ...suffix);
  if (excludedPath(file, options) || excludedPath(resolved, options)) {
    throw new Error("The managed tool directory resolves inside the project. Move the CLI tool cache outside the project and retry.");
  }
  assertAbsoluteExecutable(resolved);
  return resolved;
}

function pathDirectories(options: ExecutableResolutionOptions): string[] {
  const windows = os.platform() === "win32";
  const pathKey = Object.keys(process.env).find((key) => (windows ? key.toLowerCase() === "path" : key === "PATH"));
  return (pathKey ? process.env[pathKey] ?? "" : "")
    .split(windows ? ";" : ":")
    .map((directory) => (windows ? directory.replace(/^"(.*)"$/, "$1") : directory))
    .filter(isAbsoluteExecutable)
    .filter((directory) => {
      if (excludedPath(directory, options) || excludedSearchDirectory(directory, options)) return false;
      let canonical: string | undefined;
      try {
        canonical = realPath(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EACCES") return false;
        throw error;
      }
      return !canonical || (!excludedPath(canonical, options) && !excludedSearchDirectory(canonical, options));
    });
}

function isExecutableFile(file: string): boolean {
  if (!fs.statSync(file).isFile()) return false;
  try {
    fs.accessSync(file, os.platform() === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "ENOENT") return false;
    throw error;
  }
}

function assertNativeExecutable(file: string): void {
  assertAbsoluteExecutable(file);
  // Script interpreters may rediscover node or a shell after cwd changes.
  const fd = fs.openSync(file, "r");
  const header = Buffer.alloc(2);
  try {
    fs.readSync(fd, header, 0, header.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (header.toString() === "#!" || /\.(?:js|cjs|mjs)$/i.test(file)) {
    throw new UnsupportedExecutableError(`Unsupported internal tool script: ${file}. Install a native tool or use the CLI-managed download.`);
  }
}

/**
 * Resolve once, before changing cwd. Never use which/where or implicit cwd/PATHEXT.
 * Returned identities are canonical so directory symlinks/junctions cannot hide project tools.
 */
export function resolveTrustedExecutable(name: string, options: ExecutableResolutionOptions = {}): string | undefined {
  if (!/^[a-z0-9_-]+(?:\.exe|\.com)?$/i.test(name)) {
    throw new Error(`Expected an internal tool name, not a path: ${name}`);
  }
  const windows = os.platform() === "win32";
  const names = windows && !/\.(exe|com)$/i.test(name) ? [`${name}.exe`, `${name}.com`, `${name}.cmd`, `${name}.bat`, `${name}.ps1`] : [name];
  let unsupported: UnsupportedExecutableError | undefined;
  for (const directory of pathDirectories(options)) {
    for (const filename of names) {
      const candidate = trustedPath(platformPath().join(directory, filename), options);
      if (!candidate || excludedSearchDirectory(platformPath().dirname(candidate), options) || !isExecutableFile(candidate)) continue;
      try {
        assertNativeExecutable(candidate);
        return candidate;
      } catch (error) {
        if (!(error instanceof UnsupportedExecutableError)) throw error;
        unsupported = error;
      }
    }
  }
  if (unsupported) throw unsupported;
  return undefined;
}

const PACKAGE_MANAGER_ENTRYPOINTS = {
  npm: ["bin/npm-cli.js"],
  yarn: ["bin/yarn.js"],
  pnpm: ["bin/pnpm.cjs", "bin/pnpm.js"],
} as const;

/**
 * Bind known package-manager scripts to the already-running Node, not their shell shims.
 * Installations without a recognized entrypoint fail explicitly; shell-wrapper customizations are not executed.
 */
export function resolveTrustedPackageManager(
  name: keyof typeof PACKAGE_MANAGER_ENTRYPOINTS,
  options: ExecutableResolutionOptions = {},
): InternalExecutionSpec {
  const paths = platformPath();
  const windows = os.platform() === "win32";
  for (const directory of pathDirectories(options)) {
    const launcher = trustedPath(paths.join(directory, windows ? `${name}.cmd` : name), options);
    if (launcher && excludedSearchDirectory(paths.dirname(launcher), options)) continue;
    const providers = [
      { packageName: name, entries: PACKAGE_MANAGER_ENTRYPOINTS[name] },
      { packageName: "corepack", entries: [`dist/${name}.js`] },
    ];
    for (const { packageName, entries } of providers) {
      const packageRoots = [paths.join(directory, "node_modules", packageName)];
      if (launcher) {
        for (const entry of entries) {
          const segments = entry.split("/");
          if (launcher.toLowerCase().endsWith(paths.join(...segments).toLowerCase())) {
            packageRoots.unshift(paths.dirname(paths.dirname(launcher)));
          }
        }
      }
      for (const root of packageRoots) {
        const manifest = trustedPath(paths.join(root, "package.json"), options);
        if (!manifest) continue;
        const metadata: { name?: string; bin?: string | Record<string, string> } = JSON.parse(fs.readFileSync(manifest, "utf8"));
        if (metadata.name !== packageName) continue;
        const entry = typeof metadata.bin === "string" ? metadata.bin : metadata.bin?.[name];
        if (!entry || !entries.some((supported) => supported === entry.replace(/^\.\//, ""))) continue;
        const script = trustedPath(paths.join(root, entry), options);
        if (script && !excludedSearchDirectory(paths.dirname(script), options) && fs.statSync(script).isFile()) {
          return { executable: process.execPath, args: [script] };
        }
      }
    }
  }
  let executable: string | undefined;
  try {
    executable = resolveTrustedExecutable(name, options);
  } catch (error) {
    if (!(error instanceof UnsupportedExecutableError)) throw error;
    throw new UnsupportedExecutableError(
      `Unsupported ${name} shim. Install ${name} globally outside the project with its Node entrypoint, or use a native installation.`,
    );
  }
  if (executable) return { executable, args: [] };
  throw new Error(`Cannot find a supported ${name} installation outside the project. Install ${name} globally and retry.`);
}

/** System shells are used only for deliberate customer command strings. */
export function getTrustedShell(options: ExecutableResolutionOptions = {}): string {
  if (os.platform() !== "win32") {
    const shell = trustedPath("/bin/sh", options);
    if (shell && isExecutableFile(shell)) return shell;
  } else {
    return getTrustedWindowsSystemExecutable("cmd.exe", options);
  }
  throw new Error("Cannot locate a trusted absolute system shell outside the project. Check your operating system installation.");
}

export function getTrustedWindowsSystemExecutable(name: "cmd.exe" | "taskkill.exe", options: ExecutableResolutionOptions = {}): string {
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
  if (os.platform() === "win32" && systemRoot && isAbsoluteExecutable(systemRoot)) {
    const executable = trustedPath(path.win32.join(systemRoot, "System32", name), options);
    if (executable && isExecutableFile(executable)) return executable;
  }
  throw new Error(`Cannot locate trusted System32\\${name} outside the project. Check your Windows installation.`);
}

export function createShellExecutionSpec(command: string, cwd: string, options: ExecutableResolutionOptions = {}): InternalExecutionSpec {
  const executable = getTrustedShell(options);
  if (os.platform() === "win32") {
    return { executable, args: ["/d", "/s", "/c", `"${command}"`], cwd, windowsVerbatimArguments: true };
  }
  return { executable, args: ["-c", command], cwd };
}

export function probeExecutable(executable: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  assertAbsoluteExecutable(executable);
  return promisify(execFile)(executable, args, { encoding: "utf8", shell: false });
}
