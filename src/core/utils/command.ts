import process from "process";
import { execFileSync, execSync } from "child_process";
import { assertAbsoluteExecutable, ExecutableResolutionOptions, getTrustedShell, InternalExecutionSpec } from "./executable.js";

export function runCommand(command: string, cwd?: string, options: ExecutableResolutionOptions = {}) {
  execSync(command, {
    stdio: "inherit",
    cwd: cwd ?? process.cwd(),
    shell: getTrustedShell({ ...options, untrustedRoots: [...(options.untrustedRoots ?? []), ...(cwd ? [{ directory: cwd }] : [])] }),
    // Set CI to avoid extra NPM logs and potentially unwanted interactive modes
    env: {
      ...process.env,
      // Internal flag to avoid duplicating user messages
      SWA_CLI_INTERNAL_COMMAND: "1",
    },
  });
}

export function execFileCommand(command: string, cwd?: string, args?: string[]) {
  return execInternalCommand({ executable: command, cwd, args: args ?? [] });
}

export function execInternalCommand(spec: InternalExecutionSpec) {
  assertAbsoluteExecutable(spec.executable);
  if (spec.windowsVerbatimArguments) throw new Error("Windows customer-shell specs must use the asynchronous process supervisor.");
  return execFileSync(spec.executable, spec.args, {
    cwd: spec.cwd ?? process.cwd(),
    stdio: "inherit",
    env: { ...process.env, ...spec.env, SWA_CLI_INTERNAL_COMMAND: "1" },
  });
}
