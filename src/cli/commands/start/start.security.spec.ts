import "../../../../tests/_mocks/fs.js";
import "../../../../tests/_mocks/posix.js";
import { childProcess, directLaunches, mockInternalProcesses } from "../../../../tests/_mocks/internal-process.js";
import { vol, fs } from "memfs";
import process from "node:process";
import path from "node:path";
import { concurrently } from "concurrently";
import { start } from "./start.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { getCertificate } from "../../../core/ssl.js";

vi.mock("concurrently", () => ({ concurrently: vi.fn() }));
vi.mock("../../../core/utils/net.js", () => ({ isAcceptingTcpConnections: async () => 4280, askNewPort: vi.fn(), parseUrl: vi.fn() }));
vi.mock("../../../core/utils/workflow-config.js", () => ({
  readWorkflowFile: ({ userWorkflowConfig }: { userWorkflowConfig: object }) => userWorkflowConfig,
}));
vi.mock("../../../core/func-core-tools.js", () => ({
  getCoreToolsBinary: async () => "/trusted tools/func",
  getNodeMajorVersion: () => 20,
  detectTargetCoreToolsVersion: () => 4,
  isCoreToolsVersionCompatible: () => true,
}));
vi.mock("../../../core/dataApiBuilder/index.js", () => ({ getDataApiBuilderBinaryPath: async () => "/trusted tools/dab" }));
vi.mock("../../../core/ssl.js", () => ({ getCertificate: vi.fn() }));
vi.mock("../../../core/utils/logger.js", () => ({
  logger: { silly: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

describe("start internal launches versus intentional customer commands", () => {
  let originalEnv: NodeJS.ProcessEnv;
  const options = {
    ...DEFAULT_CONFIG,
    appLocation: "/workspace/app with spaces",
    outputLocation: ".",
    apiLocation: "/workspace/api with spaces",
    dataApiLocation: "/workspace/data with spaces",
    apiPort: 7071,
    ssl: false,
  };

  beforeEach(() => {
    originalEnv = { ...process.env };
    vol.reset();
    vol.fromJSON({ "/bin/sh": "inert system-shell fixture; never executed" });
    fs.chmodSync("/bin/sh", 0o755);
    vol.mkdirSync(options.appLocation, { recursive: true });
    vol.mkdirSync(options.apiLocation, { recursive: true });
    vol.mkdirSync(options.dataApiLocation, { recursive: true });
    mockInternalProcesses();
    vi.mocked(concurrently).mockReturnValue({ result: Promise.resolve([]) } as any);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function internalShellCommands() {
    return vi
      .mocked(concurrently)
      .mock.calls.flatMap(([commands]) =>
        (commands as { name?: string; command: string }[]).filter((command) => ["swa", "api", "dataApi"].includes(command.name ?? "")),
      );
  }

  it("launches the emulator using current Node and literal server argv without the default shell adapter", async () => {
    await start(options);
    expect(
      internalShellCommands()
        .filter((command) => command.name === "swa")
        .map((command) => command.command),
    ).toEqual([]);
    const emulator = directLaunches().find((launch) => launch.file === process.execPath);
    expect(emulator).toBeDefined();
    expect(emulator!.args).toHaveLength(1);
    expect(path.isAbsolute(emulator!.args[0])).toBe(true);
    expect(emulator!.args[0]).toMatch(/[/\\]msha[/\\]server\.js$/);
    expect(emulator!.options?.shell).not.toBe(true);
  });

  it("launches Functions with the selected absolute identity, literal args and explicit API cwd", async () => {
    await start(options);
    expect(directLaunches()).toContainEqual(
      expect.objectContaining({
        file: "/trusted tools/func",
        args: ["start", "--cors", "*", "--port", "7071"],
        options: expect.objectContaining({ cwd: options.apiLocation }),
      }),
    );
    expect(
      internalShellCommands()
        .filter((command) => command.name === "api")
        .map((command) => command.command),
    ).toEqual([]);
  });

  it("passes funcArgs quotes and metacharacters as literal argv through the Functions launch", async () => {
    // Arrange
    const funcArgs = '--name "two words" "" literal&value $VALUE';
    // Act
    await start({ ...options, funcArgs });
    // Assert
    expect(directLaunches()).toContainEqual(
      expect.objectContaining({
        file: "/trusted tools/func",
        args: ["start", "--cors", "*", "--port", "7071", "--name", "two words", "", "literal&value", "$VALUE"],
        options: expect.objectContaining({ cwd: options.apiLocation, shell: false }),
      }),
    );
  });

  it("rejects malformed funcArgs before spawning any emulator or tool", async () => {
    // Arrange / Act
    await start({ ...options, funcArgs: '"unclosed' });
    // Assert
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it("launches DAB with the selected absolute identity, literal args and explicit data cwd", async () => {
    await start(options);
    expect(directLaunches()).toContainEqual(
      expect.objectContaining({
        file: "/trusted tools/dab",
        args: ["start", "-c", "staticwebapp.database.config.json", "--no-https-redirect"],
        options: expect.objectContaining({ cwd: options.dataApiLocation }),
      }),
    );
    expect(
      internalShellCommands()
        .filter((command) => command.name === "dataApi")
        .map((command) => command.command),
    ).toEqual([]);
  });

  it("preserves the deliberate --run shell command instead of classifying it as an internal tool", async () => {
    const run = "npm run preview && echo done";
    await start({ ...options, run });
    expect(process.env.SWA_CLI_STARTUP_COMMAND).toBe(run);
    const shells = [
      ...vi
        .mocked(concurrently)
        .mock.calls.flatMap(([commands]) =>
          (commands as { name?: string; command: string }[]).filter((command) => command.name === "run").map((command) => command.command),
        ),
      ...childProcess.exec.mock.calls.map(([command]) => command),
      ...directLaunches().flatMap((launch) => launch.args),
    ];
    expect(shells.some((command) => command.includes(run))).toBe(true);
    expect(directLaunches()).toContainEqual(
      expect.objectContaining({ file: "/bin/sh", args: ["-c", run], options: expect.objectContaining({ shell: false }) }),
    );
  });

  it("preserves user-supplied TLS key and certificate without generating replacements", async () => {
    await start({ ...options, ssl: true, sslCert: "/user certs/cert.pem", sslKey: "/user certs/key.pem" });
    expect(getCertificate).not.toHaveBeenCalled();
    expect(process.env.SWA_CLI_APP_SSL_CERT).toBe("/user certs/cert.pem");
    expect(process.env.SWA_CLI_APP_SSL_KEY).toBe("/user certs/key.pem");
  });
});
