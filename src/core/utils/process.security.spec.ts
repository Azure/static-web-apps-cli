import "../../../tests/_mocks/fs.js";
import { childProcess } from "../../../tests/_mocks/internal-process.js";
import { fs } from "memfs";
import { EventEmitter } from "node:events";
import os from "node:os";
import process from "node:process";
import { superviseProcesses, NamedExecutionSpec } from "./process.js";

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
    expect(childProcess.spawn).toHaveBeenNthCalledWith(1, "/trusted/node", ["literal space", ";"], {
      cwd: "/project/app",
      env: { ...process.env, TEST_CONTEXT: "inherited" },
      stdio: "inherit",
      shell: false,
      detached: true,
      windowsVerbatimArguments: undefined,
    });
  });

  it("rolls back owned siblings on asynchronous spawn error", async () => {
    // Arrange
    const error = new Error("spawn failed");
    const result = superviseProcesses(commands).catch((events) => events);
    // Act
    first.emit("error", error);
    second.emit("close", null, "SIGTERM");
    // Assert
    expect((await result)[0].error).toBe(error);
    expect(process.kill).toHaveBeenCalledWith(-second.pid, "SIGTERM");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops later launches and cleans earlier children after synchronous spawn failure", async () => {
    // Arrange
    childProcess.spawn
      .mockReset()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(() => {
        throw new Error("sync spawn");
      });
    const result = superviseProcesses([...commands, { name: "never", execution: commands[0].execution }]).catch((events) => events);
    // Act
    first.emit("close", null, "SIGTERM");
    // Assert
    expect((await result)[2]).toMatchObject({ command: { name: "never" }, killed: true, exitCode: 1 });
    expect(childProcess.spawn).toHaveBeenCalledTimes(2);
    expect(process.kill).toHaveBeenCalledWith(-first.pid, "SIGTERM");
  });

  it.each(["SIGINT", "SIGTERM"] as const)("cleans owned groups and removes %s listeners and timers", async (signal) => {
    // Arrange
    const listeners = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
    const result = superviseProcesses(commands).catch((events) => events);
    // Act: emit the EventEmitter notification, never send a real OS signal.
    process.emit(signal);
    first.emit("close", null, signal);
    second.emit("close", null, signal);
    const events = await result;
    // Assert
    expect(events.every((event: { terminationSignal: string }) => event.terminationSignal === signal)).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(-first.pid, signal);
    expect(process.kill).toHaveBeenCalledWith(-first.pid, "SIGKILL");
    expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(listeners);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds escalation and completion even when force-kill never produces close", async () => {
    // Arrange
    const result = superviseProcesses(commands).catch((events) => events);
    // Act
    process.emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(5000);
    expect(process.kill).toHaveBeenCalledWith(-second.pid, "SIGKILL");
    await vi.advanceTimersByTimeAsync(5000);
    // Assert
    expect((await result).every((event: { error: Error }) => /cleanup timed out/.test(event.error.message))).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses absolute System32 taskkill with literal owned PID argv on simulated Windows", async () => {
    // Arrange: simulated filesystem identities, no real cleanup executable.
    vi.mocked(os.platform).mockReturnValue("win32");
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.spyOn(fs, "realpathSync").mockImplementation(((file: unknown) => String(file)) as typeof fs.realpathSync);
    vi.spyOn(fs, "statSync").mockReturnValue({ isFile: () => true } as any);
    vi.spyOn(fs, "accessSync").mockReturnValue(undefined);
    childProcess.execFile.mockImplementation((_file, _args, _options, callback) => callback(null));
    const windowsCommands = commands.map((command) => ({ ...command, execution: { ...command.execution, executable: "C:\\trusted\\node.exe" } }));
    const result = superviseProcesses(windowsCommands).catch((events) => events);
    // Act
    process.emit("SIGINT");
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
    expect(childProcess.spawn.mock.calls[0][2]).toMatchObject({ shell: false, detached: false });
  });

  it("rejects empty or relative execution specs before launching", async () => {
    // Arrange / Act / Assert
    await expect(superviseProcesses([])).rejects.toThrow(/No processes/);
    await expect(superviseProcesses([{ name: "bad", execution: { executable: "node", args: [] } }])).rejects.toThrow(/absolute path/);
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });
});
