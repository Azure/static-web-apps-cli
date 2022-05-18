import process from "process";
import { execSync } from "child_process";

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
