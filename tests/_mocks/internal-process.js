import { vi } from "vitest";
import { promisify } from "node:util";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

// No fixture is ever executed. Capture both Node specifier forms, including
// APIs a future implementation may choose instead of exec.
const childProcess = vi.hoisted(() => ({
  exec: vi.fn(),
  execFile: vi.fn(),
  execSync: vi.fn(),
  execFileSync: vi.fn(),
  spawn: vi.fn(),
  spawnSync: vi.fn(),
  fork: vi.fn(),
}));
export { childProcess };

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, ...childProcess, default: { ...actual, ...childProcess } };
});
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, ...childProcess, default: { ...actual, ...childProcess } };
});

export function mockInternalProcesses(stdout = "", error = undefined) {
  const makeChild = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = vi.fn();
    child.pid = 12345;
    queueMicrotask(() => {
      child.stdout.end(stdout);
      child.stderr.end();
      child.emit("exit", error ? 1 : 0, null);
      child.emit("close", error ? 1 : 0, null);
    });
    return child;
  };
  for (const fn of [childProcess.exec, childProcess.execFile]) {
    fn.mockImplementation((...args) => {
      const callback = args.at(-1);
      if (typeof callback === "function") callback(error ?? null, stdout, "");
      return makeChild();
    });
    // Node's exec/execFile promisification returns {stdout, stderr}, not just
    // stdout. Keep that contract while recording the original launch.
    fn[promisify.custom] = (...args) =>
      new Promise((resolve, reject) => {
        fn(...args, (err, out, stderr) => (err ? reject(err) : resolve({ stdout: out, stderr })));
      });
  }
  for (const fn of [childProcess.execSync, childProcess.execFileSync]) {
    fn.mockImplementation(() => {
      if (error) throw error;
      return Buffer.from(stdout);
    });
  }
  childProcess.spawn.mockImplementation(makeChild);
  childProcess.fork.mockImplementation(makeChild);
  childProcess.spawnSync.mockReturnValue({ status: error ? 1 : 0, stdout: Buffer.from(stdout), stderr: Buffer.alloc(0), error });
}

export function directLaunches() {
  return [childProcess.execFile, childProcess.execFileSync, childProcess.spawn, childProcess.spawnSync].flatMap((fn) =>
    fn.mock.calls.map(([file, args, options]) => ({ file, args, options })),
  );
}
