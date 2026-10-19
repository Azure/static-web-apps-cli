import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { concurrently, Command, CloseEvent } from "concurrently";
import os from "node:os";
import process from "node:process";
import { ExecutableResolutionOptions, getTrustedWindowsSystemExecutable, InternalExecutionSpec, prepareExecution } from "./executable.js";
import { logger } from "./logger.js";

export interface NamedExecutionSpec {
  name: string;
  execution: InternalExecutionSpec;
}

export interface ProcessCloseEvent extends Pick<CloseEvent, "command" | "exitCode" | "killed"> {
  terminationSignal?: NodeJS.Signals;
  error?: Error;
}

/**
 * The named concurrently core retains raw I/O and wait-for-all completion.
 * Only spawn errors and parent signals trigger coordinated cleanup; ordinary exits do not.
 */
export async function superviseProcesses(commands: NamedExecutionSpec[], options: ExecutableResolutionOptions = {}): Promise<ProcessCloseEvent[]> {
  if (!commands.length) throw new Error("No processes were provided.");
  const executions = commands.map(({ execution }) => prepareExecution(execution));
  const windows = os.platform() === "win32";
  const taskkill = windows ? getTrustedWindowsSystemExecutable("taskkill.exe", options) : undefined;
  let running: Command[] = [];
  const owned = new Map<number, number>();
  const finished = new Set<number>();
  const errors = new Map<number, Error>();
  const signals = new Map<number, NodeJS.Signals>();
  let stopping: NodeJS.Signals | undefined;
  let escalation: NodeJS.Timeout | undefined;
  let deadline: NodeJS.Timeout | undefined;

  const kill = (pid: number, signal = "SIGTERM") => {
    const index = owned.get(pid);
    if (index === undefined) throw new Error("Refusing to stop an unowned process.");
    if (taskkill) {
      execFile(taskkill, ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, (error) => {
        if (error && !finished.has(index)) {
          logger.warn("Unable to stop a child process tree. Check the running emulator/tool processes.");
        }
      });
    } else {
      try {
        // Each child owns its group, including descendants created by customer shells.
        process.kill(-pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
  };

  const finish = (command: Command, error?: Error) => {
    if (finished.has(command.index)) return;
    if (error) errors.set(command.index, error);
    const now = new Date();
    command.close.next({
      command,
      index: command.index,
      exitCode: 1,
      killed: signals.has(command.index),
      timings: { startDate: now, endDate: now, durationSeconds: 0 },
    });
    // A spawn error may also produce a later native close event; count the command only once.
    command.close.complete();
  };

  const terminate = (signal: NodeJS.Signals) => {
    for (const command of running) {
      if (finished.has(command.index)) continue;
      signals.set(command.index, stopping ?? signal);
      try {
        command.kill(signal);
      } catch (error) {
        logger.warn(`Unable to stop a child process: ${(error as Error).message}`);
      }
    }
  };
  const stop = (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = signal;
    terminate(signal);
    escalation = setTimeout(() => {
      terminate("SIGKILL");
      deadline = setTimeout(() => {
        for (const command of running) {
          finish(command, new Error("Child process cleanup timed out. Check the running emulator/tool processes."));
        }
      }, 5000);
    }, 5000);
  };
  const onInterrupt = () => stop("SIGINT");
  const onTerminate = () => stop("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  const closeEvent = (event: CloseEvent): ProcessCloseEvent => ({
    ...event,
    terminationSignal: signals.get(event.index),
    error: errors.get(event.index),
    killed: event.killed || signals.has(event.index),
  });
  try {
    const core = concurrently(
      commands.map(({ name }, index) => ({ name, command: `swa-internal-${index}` })),
      {
        raw: true,
        controllers: [
          {
            handle(coreCommands) {
              running = coreCommands;
              for (const command of running) {
                command.close.subscribe(() => {
                  finished.add(command.index);
                  if (!windows && signals.has(command.index) && command.pid) {
                    try {
                      kill(command.pid, "SIGKILL");
                    } catch (error) {
                      logger.warn(`Unable to stop remaining child processes: ${(error as Error).message}`);
                    }
                  }
                });
              }
              return { commands: running };
            },
          },
        ],
        kill,
        spawn(key) {
          const index = Number(key.slice("swa-internal-".length));
          const execution = executions[index];
          if (!execution) throw new Error("Unknown internal execution identity.");
          try {
            if (!stopping) {
              const child = spawn(execution.executable, execution.args, {
                cwd: execution.cwd ?? process.cwd(),
                env: execution.env ?? process.env,
                stdio: "inherit",
                shell: false,
                detached: !windows,
                windowsVerbatimArguments: execution.windowsVerbatimArguments,
              });
              if (child.pid) owned.set(child.pid, index);
              child.once("error", (error: Error) => {
                stop("SIGTERM");
                finish(running[index], error);
              });
              return child;
            }
          } catch (error) {
            errors.set(index, error instanceof Error ? error : new Error(String(error)));
            stop("SIGTERM");
          }
          signals.set(index, stopping!);
          queueMicrotask(() => finish(running[index], errors.get(index)));
          return Object.assign(new EventEmitter(), { stdin: null, stdout: null, stderr: null });
        },
      },
    );
    try {
      return (await core.result).map(closeEvent);
    } catch (error) {
      if (!Array.isArray(error)) throw error;
      throw error.map(closeEvent);
    }
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
    if (escalation) clearTimeout(escalation);
    if (deadline) clearTimeout(deadline);
  }
}
