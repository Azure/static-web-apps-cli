import process from "process";
import { execFileSync, execSync } from "child_process";

export function runCommand(command: string, cwd?: string) {
  execSync(command, {
    stdio: "inherit",
    cwd: cwd ?? process.cwd(),
    // Set CI to avoid extra NPM logs and potentially unwanted interactive modes
    env: {
      ...process.env,
      // Internal flag to avoid duplicating user messages
      SWA_CLI_INTERNAL_COMMAND: "1",
    },
  });
}

export function execFileCommand(command: string, cwd?: string, args?: string[]) {
  const child = execFileSync(command, args, {
    stdio: "inherit",
    cwd: cwd ?? process.cwd(),
    // Set CI to avoid extra NPM logs and potentially unwanted interactive modes
    env: {
      ...process.env,
      // Internal flag to avoid duplicating user messages
      SWA_CLI_INTERNAL_COMMAND: "1",
    },
  });
  return child;
}
