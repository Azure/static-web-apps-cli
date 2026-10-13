import { ChildProcess, execFile, spawn } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { assertAbsoluteExecutable, ExecutableResolutionOptions, getTrustedWindowsSystemExecutable, InternalExecutionSpec } from "./executable.js";
import { logger } from "./logger.js";

export interface NamedExecutionSpec {
  name: string;
  execution: InternalExecutionSpec;
}

export interface ProcessCloseEvent {
  command: { name: string };
  exitCode: number | NodeJS.Signals;
  killed: boolean;
  terminationSignal?: NodeJS.Signals;
  error?: Error;
}

interface RunningProcess {
  child: ChildProcess;
  finished: boolean;
  terminationSignal?: NodeJS.Signals;
  finish: (exitCode: number | NodeJS.Signals, error?: Error) => void;
}

/**
 * Raw-I/O supervision preserves wait-for-all completion, without a shell-string adapter.
 * Only spawn errors and parent signals trigger coordinated cleanup; ordinary exits do not.
 */
export async function superviseProcesses(commands: NamedExecutionSpec[], options: ExecutableResolutionOptions = {}): Promise<ProcessCloseEvent[]> {
  if (!commands.length) throw new Error("No processes were provided.");
  commands.forEach(({ execution }) => assertAbsoluteExecutable(execution.executable));
  const windows = os.platform() === "win32";
  const taskkill = windows ? getTrustedWindowsSystemExecutable("taskkill.exe", options) : undefined;
  const running: RunningProcess[] = [];
  let stopping: NodeJS.Signals | undefined;
  let escalation: NodeJS.Timeout | undefined;
  let deadline: NodeJS.Timeout | undefined;

  const kill = (child: ChildProcess, signal: NodeJS.Signals) => {
    if (!child.pid) return;
    if (taskkill) {
      execFile(taskkill, ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, (error) => {
        if (error && child.exitCode === null && child.signalCode === null) {
          logger.warn("Unable to stop a child process tree. Check the running emulator/tool processes.");
        }
      });
    } else {
      try {
        // Each child owns its group, including descendants created by customer shells.
        process.kill(-child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
  };

  const stop = (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = signal;
    for (const entry of running) {
      if (!entry.finished) {
        entry.terminationSignal = signal;
        try {
          kill(entry.child, signal);
        } catch (error) {
          logger.warn(`Unable to stop a child process: ${(error as Error).message}`);
        }
      }
    }
    escalation = setTimeout(() => {
      for (const entry of running) {
        if (!entry.finished) {
          try {
            kill(entry.child, "SIGKILL");
          } catch (error) {
            logger.warn(`Unable to stop a child process: ${(error as Error).message}`);
          }
        }
      }
      deadline = setTimeout(() => {
        for (const entry of running) {
          if (!entry.finished) entry.finish(1, new Error("Child process cleanup timed out. Check the running emulator/tool processes."));
        }
      }, 5000);
    }, 5000);
  };
  const onInterrupt = () => stop("SIGINT");
  const onTerminate = () => stop("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  try {
    const results = commands.map(
      ({ name, execution }) =>
        new Promise<ProcessCloseEvent>((resolve) => {
          if (stopping) {
            resolve({ command: { name }, exitCode: 1, killed: true, terminationSignal: stopping });
            return;
          }
          let child: ChildProcess;
          try {
            child = spawn(execution.executable, execution.args, {
              cwd: execution.cwd ?? process.cwd(),
              env: { ...process.env, ...execution.env },
              stdio: "inherit",
              shell: false,
              detached: !windows,
              windowsVerbatimArguments: execution.windowsVerbatimArguments,
            });
          } catch (error) {
            stop("SIGTERM");
            resolve({ command: { name }, exitCode: 1, killed: false, error: error as Error });
            return;
          }
          const entry: RunningProcess = {
            child,
            finished: false,
            finish: (exitCode, error) => {
              if (entry.finished) return;
              entry.finished = true;
              if (entry.terminationSignal && !windows) {
                try {
                  kill(entry.child, "SIGKILL");
                } catch (cleanupError) {
                  logger.warn(`Unable to stop remaining child processes: ${(cleanupError as Error).message}`);
                }
              }
              resolve({ command: { name }, exitCode, killed: !!entry.terminationSignal, terminationSignal: entry.terminationSignal, error });
            },
          };
          running.push(entry);
          child.once("close", (code: number | null, signal: NodeJS.Signals | null) => entry.finish(signal ?? code ?? 1));
          child.once("error", (error: Error) => {
            stop("SIGTERM");
            entry.finish(1, error);
          });
        }),
    );
    const events = await Promise.all(results);
    if (events.some((event) => event.exitCode !== 0 || event.error || event.terminationSignal)) throw events;
    return events;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
    if (escalation) clearTimeout(escalation);
    if (deadline) clearTimeout(deadline);
  }
}
