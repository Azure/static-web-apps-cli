import "../../../tests/_mocks/fs.js";
import { childProcess } from "../../../tests/_mocks/internal-process.js";
import { fs } from "memfs";
import { EventEmitter } from "node:events";
import os from "node:os";
import process from "node:process";
import { superviseProcesses, NamedExecutionSpec } from "./process.js";

const coreHook = vi.hoisted(() => ({ commands: [] as import("concurrently").Command[], options: vi.fn() }));
vi.mock("concurrently", async (importOriginal) => {
  const actual = await importOriginal<typeof import("concurrently")>();
  return {
    ...actual,
    concurrently: (...args: Parameters<typeof actual.concurrently>) => {
      coreHook.options({ ...args[1] });
      const core = actual.concurrently(...args);
      coreHook.commands = core.commands;
      return core;
    },
  };
});
vi.mock("./logger.js", () => ({ logger: { warn: vi.fn() } }));

describe("direct process supervisor lifecycle (all launches/signals intercepted)", () => {
  function child(pid: number) {
    return Object.assign(new EventEmitter(), { pid, exitCode: null, signalCode: null });
  }
  let first: ReturnType<typeof child>;
  let second: ReturnType<typeof child>;
  const commands: NamedExecutionSpec[] = [
    {
      name: "first",
      execution: { executable: "/trusted/node", args: ["literal space", ";"], cwd: "/project/app", env: { TEST_CONTEXT: "inherited" } },
    },
    { name: "second", execution: { executable: "/trusted/func", args: ["start"] } },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(os, "platform").mockReturnValue("linux");
    vi.spyOn(process, "kill").mockReturnValue(true);
    first = child(10101);
    second = child(10102);
    childProcess.spawn.mockReturnValueOnce(first).mockReturnValueOnce(second);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("waits for all successful children rather than settling on the first close", async () => {
    // Arrange
    let settled = false;
    const result = superviseProcesses(commands).then((events) => {
      settled = true;
      return events;
    });
    // Act
    first.emit("close", 0, null);
    await Promise.resolve();
    expect(settled).toBe(false);
    second.emit("close", 0, null);
    // Assert
    expect((await result).map((event) => event.command.name)).toEqual(["first", "second"]);
    expect(process.kill).not.toHaveBeenCalled();
  });

  it("waits for remaining children on ordinary nonzero exit without sibling termination", async () => {
    // Arrange
    let settled = false;
    const result = superviseProcesses(commands).catch((events) => {
      settled = true;
      return events;
    });
    // Act
    first.emit("close", 2, null);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(process.kill).not.toHaveBeenCalled();
    second.emit("close", 0, null);
    // Assert
    expect((await result).map((event: { exitCode: number }) => event.exitCode)).toEqual([2, 0]);
  });

  it("passes direct argv, explicit cwd and inherited plus specified env without a shell", async () => {
    // Arrange
    const result = superviseProcesses(commands);
    // Act
    first.emit("close", 0, null);
    second.emit("close", 0, null);
    await result;
    // Assert
    expect(childProcess.spawn).toHaveBeenNthCalledWith(
      1,
      "/trusted/node",
      ["literal space", ";"],
      expect.objectContaining({
        cwd: "/project/app",
        env: { ...process.env, TEST_CONTEXT: "inherited" },
        stdio: "inherit",
        shell: false,
        windowsVerbatimArguments: undefined,
      }),
    );
    expect(childProcess.spawn.mock.calls[0][2]?.detached).not.toBe(true);
  });

  it("does not add parent signal listeners while the real named core owns running children", async () => {
    // Arrange
    const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
    // Act: record while running, but close before asserting so RED cannot leak listeners.
    const result = superviseProcesses(commands);
    const running = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
    first.emit("close", 0, null);
    second.emit("close", 0, null);
    await result;
    // Assert
    expect(running).toEqual(before);
  });

  it("leaves POSIX cleanup to the dependency default instead of installing a kill override", async () => {
    // Arrange / Act
    const result = superviseProcesses(commands);
    const options = { ...coreHook.options.mock.calls[0][0] };
    first.emit("close", 0, null);
    second.emit("close", 0, null);
    await result;
    // Assert: core fills defaults in place, so inspect what was supplied before forwarding.
    expect(options.kill).toBeUndefined();
  });

  it("waits for native close after an asynchronous spawn error without killing siblings", async () => {
    // Arrange
    const error = new Error("spawn failed");
    let settled = false;
    const result = superviseProcesses(commands)
      .catch((events) => events)
      .then((events) => {
        settled = true;
        return events;
      });
    // Act
    first.emit("error", error);
    await Promise.resolve();
    const beforeNativeClose = settled;
    first.emit("close", 1, null);
    second.emit("close", 0, null);
    // Assert
    expect((await result).map((event: { exitCode: number }) => event.exitCode)).toEqual([1, 0]);
    expect(beforeNativeClose).toBe(false);
    expect(process.kill).not.toHaveBeenCalled();
  });

  it("leaves a synchronous spawn failure to the named core without adding rollback policy", () => {
    // Arrange
    childProcess.spawn
      .mockReset()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(() => {
        throw new Error("sync spawn");
      });
    const launch = () => superviseProcesses(commands);
    // Assert
    expect(launch).toThrow("sync spawn");
    first.emit("close", 0, null);
    expect(childProcess.spawn).toHaveBeenCalledTimes(2);
    expect(process.kill).not.toHaveBeenCalled();
  });

  it.each(["SIGINT", "SIGTERM"] as const)("keeps native %s closes core-owned without custom signal fields", async (signal) => {
    // Arrange
    const listeners = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
    const result = superviseProcesses(commands).catch((events) => events);
    // Act: native close notification only; no invented parent-signal controller.
    first.emit("close", null, signal);
    second.emit("close", null, signal);
    const events = await result;
    // Assert
    expect(events.map((event: { exitCode: string; killed: boolean }) => [event.exitCode, event.killed])).toEqual([
      [signal, false],
      [signal, false],
    ]);
    expect(process.kill).not.toHaveBeenCalled();
    expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(listeners);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not synthesize deadline completion before native close", async () => {
    // Arrange
    let settled = false;
    const result = superviseProcesses(commands).then((events) => {
      settled = true;
      return events;
    });
    // Act
    await vi.advanceTimersByTimeAsync(10000);
    const beforeNativeClose = settled;
    first.emit("close", 0, null);
    second.emit("close", 0, null);
    await result;
    // Assert
    expect(beforeNativeClose).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses absolute System32 taskkill through actual core Command.kill despite CWD and ComSpec canaries", async () => {
    // Arrange: simulated filesystem identities, no real cleanup executable.
    vi.mocked(os.platform).mockReturnValue("win32");
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.stubEnv("ComSpec", "C:\\project\\cmd.exe");
    vi.stubEnv("PATH", "C:\\trusted");
    vi.spyOn(fs, "realpathSync").mockImplementation(((file: unknown) => String(file)) as typeof fs.realpathSync);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    vi.spyOn(fs, "accessSync").mockReturnValue(undefined);
    childProcess.execFile.mockImplementation((_file, _args, _options, callback) => callback(null));
    const windowsCommands = commands.map((command) => ({ ...command, execution: { ...command.execution, executable: "C:\\trusted\\node.exe" } }));
    const result = superviseProcesses(windowsCommands).catch((events) => events);
    // Act
    coreHook.commands[0].kill("SIGINT");
    first.emit("close", 1, null);
    second.emit("close", 1, null);
    await result;
    // Assert
    expect(childProcess.execFile).toHaveBeenCalledWith(
      "C:\\Windows\\System32\\taskkill.exe",
      ["/PID", String(first.pid), "/T", "/F"],
      { windowsHide: true },
      expect.any(Function),
    );
    expect(process.kill).not.toHaveBeenCalled();
    expect(childProcess.execFile).toHaveBeenCalledTimes(1);
    expect(childProcess.spawn.mock.calls[0][2]).toMatchObject({ shell: false });
  });

  it("rejects empty or relative execution specs before launching", () => {
    // Arrange / Act / Assert
    expect(() => superviseProcesses([])).toThrow(/no commands/);
    expect(() => superviseProcesses([{ name: "bad", execution: { executable: "node", args: [] } }])).toThrow(/absolute path/);
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });
});
