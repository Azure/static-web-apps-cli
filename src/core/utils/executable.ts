import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";

export interface InternalExecutionSpec {
  executable: string;
  args: string[];
  cwd?: string;
  /** Overrides on input; a prepared environment, when present, is a complete snapshot. */
  env?: NodeJS.ProcessEnv;
  resolutionOptions?: ExecutableResolutionOptions;
  /** Arguments have already been encoded for an absolute Windows shell. */
  windowsVerbatimArguments?: boolean;
}

export interface ExecutableDirectoryExclusion {
  /** An exact invocation directory, not a recursive project boundary. */
  directory: string;
}

export type ExecutableExclusion = string | ExecutableDirectoryExclusion;

export interface ExecutableResolutionOptions {
  /** Working directory for caller-relative PATH entries and the selected tool's probe. */
  cwd?: string;
  /** Project boundaries for fixed system identities and managed paths, not configured PATH choices. */
  untrustedRoots?: readonly ExecutableExclusion[];
}

export class UnsupportedExecutableError extends Error {}

let callerPath: { value: string | undefined; extensions: string | undefined } | undefined;
const absentCallerPath = "SWA_CLI_INTERNAL_PATH_ABSENT";

function pathValue(env: NodeJS.ProcessEnv, name = "PATH"): string | undefined {
  const windows = os.platform() === "win32";
  const key = Object.keys(env).find((key) => (windows ? key.toLowerCase() === name.toLowerCase() : key === name));
  return key ? env[key] : undefined;
}

/** Capture inherited lookup configuration before project dotenv can fill missing PATH/PATHEXT. */
export function captureCallerPath(): void {
  let value = pathValue(process.env);
  if (os.platform() === "win32" && process.env[absentCallerPath] === "1" && value === "") {
    for (const key of Object.keys(process.env)) {
      if (key.toLowerCase() === "path") delete process.env[key];
    }
    value = undefined;
  }
  delete process.env[absentCallerPath];
  callerPath = { value, extensions: pathValue(process.env, "PATHEXT") };
}

function preserveCallerLookup(env: NodeJS.ProcessEnv): void {
  delete env[absentCallerPath];
  if (os.platform() !== "win32" || !callerPath) return;
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === "pathext") delete env[key];
  }
  // An undefined override prevents composed command environments from restoring project PATHEXT.
  env.PATHEXT = callerPath.extensions;
  if (callerPath.value === undefined) env[absentCallerPath] = "1";
}

function executionEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (os.platform() === "win32") {
      for (const existing of Object.keys(env)) {
        if (existing.toLowerCase() === key.toLowerCase()) delete env[existing];
      }
    }
    env[key] = value;
  }
  return env;
}

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

function executablePath(file: string): string | undefined {
  if (!isAbsoluteExecutable(file)) return undefined;

  let canonical: string | undefined;
  try {
    canonical = realPath(file);
  } catch (error) {
    // An inaccessible PATH candidate cannot be selected; other absolute entries may still be usable.
    if ((error as NodeJS.ErrnoException).code === "EACCES") return undefined;
    throw error;
  }
  if (!canonical || !isAbsoluteExecutable(canonical)) return undefined;
  return canonical;
}

function trustedPath(file: string, options: ExecutableResolutionOptions): string | undefined {
  if (excludedPath(file, options)) return undefined;
  const canonical = executablePath(file);
  return canonical && !excludedPath(canonical, options) ? canonical : undefined;
}

function canonicalPath(file: string): string | undefined {
  const paths = platformPath();
  const suffix: string[] = [];
  let parent = file;
  let canonical = realPath(parent);
  while (!canonical) {
    const next = paths.dirname(parent);
    if (next === parent) return undefined;
    suffix.unshift(paths.basename(parent));
    parent = next;
    canonical = realPath(parent);
  }
  return paths.join(canonical, ...suffix);
}

/** Bind a managed path even before download, while checking existing parent-directory aliases. */
export function resolveManagedExecutable(file: string, options: ExecutableResolutionOptions = {}): string {
  assertAbsoluteExecutable(file);
  const resolved = canonicalPath(file);
  if (!resolved) throw new Error(`Cannot resolve managed executable directory: ${file}`);
  if (excludedPath(file, options) || excludedPath(resolved, options)) {
    throw new Error("The managed tool directory resolves inside the project. Move the CLI tool cache outside the project and retry.");
  }
  assertAbsoluteExecutable(resolved);
  return resolved;
}

function pathDirectories(options: ExecutableResolutionOptions, env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string[] {
  const windows = os.platform() === "win32";
  let value = callerPath ? callerPath.value : pathValue(env);
  if (value === undefined && !windows) {
    const defaultEnv = { ...env };
    delete defaultEnv.PATH;
    const result = spawnSync(getTrustedShell(options), ["-c", 'printf "%s" "$PATH"'], {
      cwd,
      env: defaultEnv,
      encoding: "utf8",
      timeout: 5000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Cannot determine the system shell's default PATH.");
    value = result.stdout;
  }
  return (
    (value ?? "")
      .split(windows ? ";" : ":")
      .map((directory) => (windows ? directory.replace(/^"(.*)"$/, "$1") : directory))
      // Empty Windows entries do not declare CWD; normalize them before guarded cmd lookup.
      .filter((directory) => !windows || directory !== "")
      .map((directory) => platformPath().resolve(cwd, directory || "."))
      .flatMap((directory) => {
        let canonical: string | undefined;
        try {
          canonical = canonicalPath(directory);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EACCES") return [];
          throw error;
        }
        return canonical ? [canonical] : [];
      })
  );
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

function shebang(file: string): { interpreter: string; argument?: string } | undefined {
  if (!fs.existsSync(file)) return undefined;
  const fd = fs.openSync(file, "r");
  const header = Buffer.alloc(4096);
  try {
    const length = fs.readSync(fd, header, 0, header.length, 0);
    const line = header.subarray(0, length).toString("utf8").split(/\r?\n/, 1)[0];
    const match = /^#!\s*(\S+)(?:[ \t]+(.+?))?[ \t]*$/.exec(line);
    return match ? { interpreter: match[1], argument: match[2] } : undefined;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Bind configured PATH order, including project-local tools, without Windows' extra CWD search.
 * Relative entries resolve at lookup; canonical identities survive later working-directory changes.
 */
export function resolveTrustedExecutable(name: string, options: ExecutableResolutionOptions = {}): string | undefined {
  if (!/^[a-z0-9_-]+(?:\.exe|\.com)?$/i.test(name)) {
    throw new Error(`Expected an internal tool name, not a path: ${name}`);
  }
  const windows = os.platform() === "win32";
  const extensions = callerPath ? callerPath.extensions : pathValue(process.env, "PATHEXT");
  // cmd supplies native/batch defaults only for absent or empty PATHEXT, not for an explicit list.
  const names =
    windows && !/\.(exe|com)$/i.test(name)
      ? (extensions || ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .filter((extension) => /^\.(com|exe|bat|cmd)$/i.test(extension))
          .map((extension) => `${name}${extension.toLowerCase()}`)
      : [name];
  for (const directory of pathDirectories(options, process.env, options.cwd)) {
    for (const filename of names) {
      const candidate = executablePath(platformPath().join(directory, filename));
      if (!candidate || !isExecutableFile(candidate)) continue;
      return candidate;
    }
  }
  return undefined;
}

export function resolveTrustedExecutablePath(file: string, options: ExecutableResolutionOptions = {}): string | undefined {
  const executable = trustedPath(file, options);
  return executable && isExecutableFile(executable) ? executable : undefined;
}

/** Keep the selected launcher's behavior instead of bypassing it through package metadata. */
export function resolveTrustedPackageManager(name: "npm" | "yarn" | "pnpm", options: ExecutableResolutionOptions = {}): InternalExecutionSpec {
  const executable = resolveTrustedExecutable(name, options);
  if (executable) return { executable, args: [], resolutionOptions: options, ...(options.cwd ? { cwd: options.cwd } : {}) };
  throw new Error(`Cannot find ${name} on the caller's PATH.`);
}

/** Bind the shell used for caller syntax or a trusted external command shim. */
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
    return { executable, args: ["/d", "/s", "/c", `"${command}"`], cwd, env: { ComSpec: executable }, windowsVerbatimArguments: true };
  }
  return { executable, args: ["-c", command], cwd };
}

function internalEnvironment(options: ExecutableResolutionOptions, overrides?: NodeJS.ProcessEnv, cwd = process.cwd()): NodeJS.ProcessEnv {
  const env = executionEnvironment(overrides);
  const windows = os.platform() === "win32";
  const directories = pathDirectories(options, env, cwd);
  for (const key of Object.keys(env)) {
    if (windows && ["path", "comspec", "nodefaultcurrentdirectoryinexepath"].includes(key.toLowerCase())) delete env[key];
  }
  env[windows ? "Path" : "PATH"] = directories.join(windows ? ";" : ":");
  if (windows) {
    env.ComSpec = getTrustedWindowsSystemExecutable("cmd.exe", options);
    env.NoDefaultCurrentDirectoryInExePath = "1";
  }
  preserveCallerLookup(env);
  return env;
}

function quoteArgument(value: string): string {
  if (os.platform() !== "win32") return `'${value.replace(/'/g, "'\\''")}'`;
  const quoted = `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1")}"`;
  return quoted.replace(/[()%!^"<>&|,;*? \t]/g, "^$&");
}

function windowsVariableExpansion(env: NodeJS.ProcessEnv, cwd: string): "%" | "!" {
  const shell = env.ComSpec;
  if (!shell) throw new Error("Missing bound Windows command interpreter.");
  const variable = "SWA_CLI_INTERNAL_DELAYED_EXPANSION";
  const result = spawnSync(shell, ["/d", "/s", "/c", `echo !${variable}!`], {
    cwd,
    env: { ...env, [variable]: "enabled" },
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 5000,
  });
  if (result.error) throw result.error;
  const output = result.stdout?.trim();
  if (result.status === 0 && output === "enabled") return "!";
  if (result.status === 0 && output === `!${variable}!`) return "%";
  throw new Error("Cannot determine the trusted Windows command interpreter's variable expansion mode.");
}

/** Only the CLI-owned prefix is encoded; the caller's explicit shell suffix is left intact. */
export function createToolShellExecutionSpec(
  executable: string,
  args: string[],
  cwd: string,
  suffix = "",
  options: ExecutableResolutionOptions = {},
): InternalExecutionSpec {
  assertAbsoluteExecutable(executable);
  const context = { untrustedRoots: [...(options.untrustedRoots ?? []), { directory: cwd }] };
  const env = internalEnvironment(context, undefined, cwd);
  let prefix: string;
  if (os.platform() === "win32") {
    env.SWA_CLI_INTERNAL_EXECUTABLE = executable;
    // Match the existing shell mode rather than disabling delayed expansion for user commands/wrappers.
    const expansion = windowsVariableExpansion(env, cwd);
    prefix = [`"${expansion}SWA_CLI_INTERNAL_EXECUTABLE${expansion}"`, ...args.map(quoteArgument)].join(" ");
  } else {
    const execution = prepareExecution({ executable, args, cwd, resolutionOptions: context });
    prefix = [execution.executable, ...execution.args].map(quoteArgument).join(" ");
  }
  return { ...createShellExecutionSpec(`${prefix}${suffix ? ` ${suffix}` : ""}`, cwd, context), env };
}

/** Native identities stay direct; script loaders retain canonical caller-selected PATH entries. */
export function prepareExecution(spec: InternalExecutionSpec): InternalExecutionSpec {
  assertAbsoluteExecutable(spec.executable);
  if (spec.windowsVerbatimArguments) return { ...spec, env: executionEnvironment(spec.env) };
  const options = {
    untrustedRoots: [
      ...(spec.resolutionOptions?.untrustedRoots ?? []),
      ...(spec.cwd ? [spec.resolutionOptions ? { directory: spec.cwd } : spec.cwd] : []),
    ],
  };
  if (os.platform() === "win32" && /\.(?:cmd|bat)$/i.test(spec.executable)) {
    return {
      ...createToolShellExecutionSpec(spec.executable, spec.args, spec.cwd ?? process.cwd(), "", options),
      env: { ...internalEnvironment(options, spec.env, spec.cwd), SWA_CLI_INTERNAL_EXECUTABLE: spec.executable },
    };
  }
  const script = shebang(spec.executable);
  if (script) {
    const interpreter = trustedPath(script.interpreter, options);
    if (!interpreter || !isExecutableFile(interpreter)) {
      throw new UnsupportedExecutableError(`Cannot bind a trusted script interpreter for ${spec.executable}.`);
    }
    return {
      ...spec,
      executable: interpreter,
      args: [...(script.argument ? [script.argument] : []), spec.executable, ...spec.args],
      env: internalEnvironment(options, spec.env, spec.cwd),
    };
  }
  if (/\.(?:ps1|js|cjs|mjs)$/i.test(spec.executable)) {
    throw new UnsupportedExecutableError(`Cannot determine the interpreter for ${spec.executable}.`);
  }
  if (!callerPath) return spec.env ? { ...spec, env: executionEnvironment(spec.env) } : spec;
  // Preserve absence too: a reentered CLI must capture PATH before loading its own project dotenv.
  const env = executionEnvironment(spec.env);
  for (const key of Object.keys(env)) {
    if (os.platform() === "win32" ? key.toLowerCase() === "path" : key === "PATH") delete env[key];
  }
  if (callerPath.value !== undefined) env[os.platform() === "win32" ? "Path" : "PATH"] = callerPath.value;
  // Windows spawn fills an omitted PATH from the parent; the entry hook restores this placeholder's absence.
  else if (os.platform() === "win32") env.Path = "";
  preserveCallerLookup(env);
  return { ...spec, env };
}

export function probeExecutable(
  executable: string,
  args: string[],
  options: ExecutableResolutionOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const spec = prepareExecution({ executable, args, cwd: options.cwd, resolutionOptions: options });
  return promisify(execFile)(spec.executable, spec.args, {
    encoding: "utf8",
    shell: false,
    ...(spec.cwd ? { cwd: spec.cwd } : {}),
    ...(spec.env ? { env: spec.env } : {}),
    ...(spec.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}),
  });
}
