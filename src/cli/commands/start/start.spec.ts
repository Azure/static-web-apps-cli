import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ConcurrentlyCommandInput, ConcurrentlyOptions, ConcurrentlyResult } from "concurrently";
import { EventEmitter } from "node:events";

const concurrentlyMock = vi.fn();
const spawnMock = vi.fn();

vi.mock("concurrently", () => ({
  concurrently: concurrentlyMock,
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("../../../core/utils/logger.js", () => ({
  logger: {
    silly: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../core/utils/net.js", () => ({
  isAcceptingTcpConnections: vi.fn().mockResolvedValue(4280),
  askNewPort: vi.fn(),
  parseUrl: vi.fn(),
}));

vi.mock("../../../core/func-core-tools.js", () => ({
  getCoreToolsBinary: vi.fn().mockResolvedValue("func"),
  getNodeMajorVersion: vi.fn().mockReturnValue(20),
  detectTargetCoreToolsVersion: vi.fn().mockReturnValue(4),
  isCoreToolsVersionCompatible: vi.fn().mockReturnValue(true),
}));

vi.mock("../../../core/dataApiBuilder/index.js", () => ({
  getDataApiBuilderBinaryPath: vi.fn(),
}));

vi.mock("../../../core/utils/json.js", () => ({
  loadPackageJson: vi.fn().mockReturnValue({ version: "test" }),
}));

function createFakeChildProcess() {
  const child = new EventEmitter() as any;
  child.pid = 12345;
  child.stdin = null;
  child.stdout = null;
  child.stderr = null;
  return child;
}

describe("swa start command execution safety", () => {
  let tempRoot: string;
  let originalExit: typeof process.exit;

  beforeEach(() => {
    concurrentlyMock.mockReset();
    spawnMock.mockReset();
    spawnMock.mockReturnValue(createFakeChildProcess());

    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "swa-start-spec-"));
    fs.mkdirSync(path.join(tempRoot, "api"), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, "app"), { recursive: true });

    originalExit = process.exit;
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.exit = originalExit;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("should spawn Functions with argv and shell disabled for funcArgs", async () => {
    let capturedCommands: ConcurrentlyCommandInput[] = [];
    let capturedOptions: Partial<ConcurrentlyOptions> = {};

    concurrentlyMock.mockImplementation((commands: ConcurrentlyCommandInput[], options: Partial<ConcurrentlyOptions>) => {
      capturedCommands = commands;
      capturedOptions = options;
      const result: ConcurrentlyResult = {
        commands: [] as any,
        result: Promise.resolve([
          {
            command: { name: "swa", command: "node server.js" },
            killed: true,
            index: 0,
            exitCode: 0,
            timings: { startDate: new Date(), endDate: new Date(), durationSeconds: 0 },
          },
        ] as any),
      };
      return result;
    });

    const { start } = await import("./start.js");
    await start({
      appLocation: path.join(tempRoot, "app"),
      outputLocation: ".",
      apiLocation: path.join(tempRoot, "api"),
      apiPort: 7071,
      host: "localhost",
      port: 4280,
      devserverTimeout: 60,
      ssl: false,
      open: false,
      swaConfigLocation: path.join(tempRoot, "app"),
      funcArgs: "| (echo vulnerable>swa-msrc-144619-windows.marker)",
    } as SWACLIConfig);

    const apiCommand = (capturedCommands as any[]).find((command) => command.name === "api")?.command as string;
    expect(apiCommand).toContain("__SWA_INTERNAL_FUNC_START__:");
    expect(apiCommand).not.toContain("vulnerable");
    expect(capturedOptions.spawn).toBeTypeOf("function");

    (capturedOptions.spawn as any)(apiCommand, { env: {} });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      "func",
      ["start", "--cors", "*", "--port", "7071", "|", "(echo", "vulnerable>swa-msrc-144619-windows.marker)"],
      expect.objectContaining({
        shell: false,
        windowsVerbatimArguments: false,
        cwd: path.join(tempRoot, "api"),
      }),
    );
  });
});
