import process from "process";
import { execFileSync, execSync, SpawnSyncOptions } from "child_process";
import { ExecutableResolutionOptions, getTrustedShell, InternalExecutionSpec, prepareExecution } from "./executable.js";

export function runCommand(command: string, cwd?: string, options: ExecutableResolutionOptions = {}) {
  const shell = getTrustedShell({ ...options, untrustedRoots: [...(options.untrustedRoots ?? []), ...(cwd ? [{ directory: cwd }] : [])] });
  execSync(command, {
    stdio: "inherit",
    cwd: cwd ?? process.cwd(),
    shell,
    // Set CI to avoid extra NPM logs and potentially unwanted interactive modes
    env: {
      ...process.env,
      ...(process.platform === "win32" ? { ComSpec: shell } : {}),
      // Internal flag to avoid duplicating user messages
      SWA_CLI_INTERNAL_COMMAND: "1",
    },
  });
}

export function execFileCommand(command: string, cwd?: string, args?: string[], resolutionOptions?: ExecutableResolutionOptions) {
  return execInternalCommand({ executable: command, cwd, args: args ?? [], resolutionOptions });
}

export function execInternalCommand(execution: InternalExecutionSpec) {
  const spec = prepareExecution(execution);
  const options: SpawnSyncOptions = {
    cwd: spec.cwd ?? process.cwd(),
    stdio: "inherit",
    env: { ...(spec.env ?? process.env), SWA_CLI_INTERNAL_COMMAND: "1" },
    windowsVerbatimArguments: spec.windowsVerbatimArguments,
  };
  return execFileSync(spec.executable, spec.args, options);
}
