import { execFile, spawn } from "node:child_process";
import { concurrently, CloseEvent } from "concurrently";
import os from "node:os";
import { getTrustedWindowsSystemExecutable, InternalExecutionSpec, prepareExecution } from "./executable.js";
import { logger } from "./logger.js";

export interface NamedExecutionSpec {
  name: string;
  execution: InternalExecutionSpec;
}

/** Bind native dispatch while leaving raw I/O and lifecycle handling to the named core. */
export function superviseProcesses(commands: NamedExecutionSpec[]): Promise<CloseEvent[]> {
  const executions = commands.map(({ execution }) => prepareExecution(execution));
  const taskkill = os.platform() === "win32" ? getTrustedWindowsSystemExecutable("taskkill.exe") : undefined;
  const core = concurrently(
    commands.map(({ name }, index) => ({ name, command: `swa-internal-${index}` })),
    {
      raw: true,
      ...(taskkill
        ? {
            kill(pid: number) {
              execFile(taskkill, ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, (error) => {
                if (error) logger.warn("Unable to stop a child process tree. Check the running emulator/tool processes.");
              });
            },
          }
        : {}),
      spawn(key, spawnOptions) {
        const execution = executions[Number(key.slice("swa-internal-".length))];
        if (!execution) throw new Error("Unknown internal execution identity.");
        return spawn(execution.executable, execution.args, {
          ...spawnOptions,
          cwd: execution.cwd ?? spawnOptions.cwd,
          env: execution.env ?? spawnOptions.env,
          shell: false,
          windowsVerbatimArguments: execution.windowsVerbatimArguments,
        });
      },
    },
  );
  return core.result;
}
