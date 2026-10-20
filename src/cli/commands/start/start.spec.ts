import "../../../../tests/_mocks/fs.js";
import "../../../../tests/_mocks/posix.js";
import { childProcess, directLaunches, mockInternalProcesses } from "../../../../tests/_mocks/internal-process.js";
import { vol, fs } from "memfs";
import process from "node:process";
import path from "node:path";
import { DEFAULT_CONFIG } from "../../../config.js";
import { getCertificate } from "../../../core/ssl.js";
import type { InternalExecutionSpec } from "../../../core/utils/executable.js";
import * as fixtureFs from "node:fs";
import * as fixtureOs from "node:os";
import * as fixturePath from "node:path";
import * as fixtureProcess from "node:process";
import * as fixtureUrl from "node:url";
import * as fixtureChildProcess from "node:child_process";

const nativeModules = {
  "node:fs": await vi.importActual<typeof import("node:fs") & { default: typeof import("node:fs") }>("node:fs"),
  "node:os": await vi.importActual<typeof import("node:os") & { default: typeof import("node:os") }>("node:os"),
  "node:path": await vi.importActual<typeof import("node:path") & { default: typeof import("node:path") }>("node:path"),
  "node:process": await vi.importActual<typeof import("node:process") & { default: typeof import("node:process") }>("node:process"),
  "node:url": await vi.importActual<typeof import("node:url")>("node:url"),
  "node:child_process": await vi.importActual<typeof import("node:child_process")>("node:child_process"),
};
const fixtureModules = {
  "node:fs": fixtureFs,
  "node:os": fixtureOs,
  "node:path": fixturePath,
  "node:process": fixtureProcess,
  "node:url": fixtureUrl,
  "node:child_process": fixtureChildProcess,
};
const simulatedProcess = process;

vi.mock("../../../core/utils/net.js", () => ({ isAcceptingTcpConnections: async () => 4280, askNewPort: vi.fn(), parseUrl: vi.fn() }));
vi.mock("../../../core/utils/workflow-config.js", () => ({
  readWorkflowFile: ({ userWorkflowConfig }: { userWorkflowConfig: object }) => userWorkflowConfig,
}));
vi.mock("../../../core/ssl.js", () => ({ getCertificate: vi.fn() }));
vi.mock("../../../core/utils/logger.js", () => ({
  logger: { silly: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

describe("start internal launches versus intentional customer commands", () => {
  let start: typeof import("./start.js").start;
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

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock("../../../core/utils/process.js");
    vi.doMock("../../../core/func-core-tools.js", () => ({
      getCoreToolsBinary: async () => "/trusted tools/func",
      getNodeMajorVersion: () => 20,
      detectTargetCoreToolsVersion: () => 4,
      isCoreToolsVersionCompatible: () => true,
    }));
    vi.doMock("../../../core/dataApiBuilder/index.js", () => ({ getDataApiBuilderBinaryPath: async () => "/trusted tools/dab" }));
    ({ start } = await import("./start.js"));
    originalEnv = { ...process.env };
    vol.reset();
    vol.fromJSON({ "/bin/sh": "inert system-shell fixture; never executed" });
    fs.chmodSync("/bin/sh", 0o755);
    vol.mkdirSync(options.appLocation, { recursive: true });
    vol.mkdirSync(options.apiLocation, { recursive: true });
    vol.mkdirSync(options.dataApiLocation, { recursive: true });
    mockInternalProcesses();
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function launches() {
    return directLaunches().map(({ file, args, options }) => ({ file, args, cwd: options?.cwd, shell: options?.shell }));
  }

  function functionsLaunch() {
    const launch = launches().find(({ cwd }) => cwd === options.apiLocation);
    expect(launch?.file).toBe("/bin/sh");
    expect(launch?.shell).toBe(false);
    expect(launch?.args[0]).toBe("-c");
    expect(launch?.args[1]).toMatch(/^'\/trusted tools\/func' 'start' '--cors' '\*' '--port' '7071'/);
    return launch!;
  }

  it("launches the emulator using current Node and literal server argv without the default shell adapter", async () => {
    await start(options);
    const emulator = launches().find((launch) => launch.file === process.execPath);
    expect(emulator).toBeDefined();
    expect(emulator!.args).toHaveLength(1);
    expect(path.isAbsolute(emulator!.args[0])).toBe(true);
    expect(emulator!.args[0]).toMatch(/[/\\]msha[/\\]server\.js$/);
    expect(emulator!.shell).toBe(false);
    expect(launches().some(({ args }) => args.some((arg: string) => arg.startsWith("swa-internal-")))).toBe(false);
  });

  it("launches Functions with a bound absolute prefix and explicit API cwd", async () => {
    process.env.PATH = `${options.apiLocation}:/bin`;
    await start(options);
    expect(functionsLaunch().args[1]).toBe("'/trusted tools/func' 'start' '--cors' '*' '--port' '7071'");
    const api = directLaunches().find(({ options: launchOptions }) => launchOptions?.cwd === options.apiLocation)!;
    expect(api.options?.env?.PATH).toBe(`${options.apiLocation}:/bin`);
  });

  it("preserves the raw funcArgs shell suffix without changing the selected Functions prefix", async () => {
    // Arrange
    const funcArgs = '--name "two words" "" "$VALUE" && echo done';
    // Act
    await start({ ...options, funcArgs });
    // Assert
    expect(functionsLaunch().args[1]).toBe(`'/trusted tools/func' 'start' '--cors' '*' '--port' '7071' ${funcArgs}`);
  });

  it("delegates unmatched suffix quotes to the bound shell instead of applying the unused argv parser", async () => {
    // Arrange / Act
    await start({ ...options, funcArgs: '"unclosed' });
    // Assert
    expect(functionsLaunch().args[1]).toBe(`'/trusted tools/func' 'start' '--cors' '*' '--port' '7071' "unclosed`);
    expect(launches().some(({ file }) => file === process.execPath)).toBe(true);
  });

  it("launches DAB with the selected absolute identity, literal args and explicit data cwd", async () => {
    await start(options);
    expect(launches()).toContainEqual(
      expect.objectContaining({
        file: "/trusted tools/dab",
        args: ["start", "-c", "staticwebapp.database.config.json", "--no-https-redirect"],
        cwd: options.dataApiLocation,
        shell: false,
      }),
    );
  });

  it("preserves the deliberate --run shell command instead of classifying it as an internal tool", async () => {
    const run = "npm run preview && echo done";
    await start({ ...options, run });
    expect(process.env.SWA_CLI_STARTUP_COMMAND).toBe(run);
    const shells = [...childProcess.exec.mock.calls.map(([command]) => command), ...launches().flatMap((launch) => launch.args)];
    expect(shells.some((command) => command.includes(run))).toBe(true);
    expect(launches()).toContainEqual(expect.objectContaining({ file: "/bin/sh", args: ["-c", run], shell: false }));
  });

  it("preserves user-supplied TLS key and certificate without generating replacements", async () => {
    await start({ ...options, ssl: true, sslCert: "/user certs/cert.pem", sslKey: "/user certs/key.pem" });
    expect(getCertificate).not.toHaveBeenCalled();
    expect(process.env.SWA_CLI_APP_SSL_CERT).toBe("/user certs/cert.pem");
    expect(process.env.SWA_CLI_APP_SSL_KEY).toBe("/user certs/key.pem");
  });
});

describe("Functions raw shell suffix compatibility (benign native argv recorder)", () => {
  const fs = nativeModules["node:fs"].default;
  const os = nativeModules["node:os"].default;
  const path = nativeModules["node:path"].default;
  const process = nativeModules["node:process"].default;
  const { spawnSync } = nativeModules["node:child_process"];
  const { fileURLToPath } = nativeModules["node:url"];
  let start: typeof import("./start.js").start;
  let createShellExecutionSpec: typeof import("../../../core/utils/executable.js").createShellExecutionSpec;
  let superviseProcesses: typeof import("../../../core/utils/process.js").superviseProcesses;
  let sandbox: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Fresh production imports use real native modules, not the unit namespace.
    vi.resetModules();
    for (const [name, module] of Object.entries(nativeModules)) vi.doMock(name, () => module);
    vi.doMock("fs", () => nativeModules["node:fs"]);
    vi.doMock("child_process", () => nativeModules["node:child_process"]);
    vi.stubGlobal("process", process);
    vi.doMock("../../../core/utils/process.js", () => ({ superviseProcesses: vi.fn() }));
    vi.doMock("../../../core/func-core-tools.js", () => ({
      getCoreToolsBinary: async () => process.execPath,
      getNodeMajorVersion: () => 20,
      detectTargetCoreToolsVersion: () => 4,
      isCoreToolsVersionCompatible: () => true,
    }));
    vi.doUnmock("../../../core/dataApiBuilder/index.js");
    ({ start } = await import("./start.js"));
    ({ createShellExecutionSpec } = await import("../../../core/utils/executable.js"));
    ({ superviseProcesses } = await import("../../../core/utils/process.js"));
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swa-suffix-compat-"));
    originalEnv = { ...process.env };
    vi.mocked(superviseProcesses).mockResolvedValue([]);
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(sandbox, { recursive: true });
    for (const [name, module] of Object.entries(fixtureModules)) vi.doMock(name, () => module);
    vi.doMock("fs", () => fixtureFs);
    vi.doMock("child_process", () => fixtureChildProcess);
    vi.stubGlobal("process", simulatedProcess);
  });

  it("preserves variable expansion and a shell operator while retaining quoted space and UNC argument values", async () => {
    const api = path.join(sandbox, "api with spaces");
    fs.mkdirSync(api);
    fs.copyFileSync(fileURLToPath(new URL("../../../../tests/fixtures/compatibility-recorder.cjs", import.meta.url)), path.join(api, "start"));
    const report = path.join(sandbox, "launch.jsonl");
    const marker = path.join(sandbox, "suffix marker.txt");
    process.env.SWA_COMPAT_REPORT = report;
    process.env.SWA_COMPAT_MARKER = marker;
    process.env.SWA_COMPAT_VALUE = "expanded two words";
    process.env.SWA_COMPAT_CERT = String.raw`\\fileserver\dev certs\local.pfx`;
    const variable = (name: string) => (process.platform === "win32" ? `%${name}%` : `$${name}`);
    const file = path.join(api, "certificate with spaces.pfx");
    const suffix = `--file "${file}" --cert "${variable("SWA_COMPAT_CERT")}" --name "${variable("SWA_COMPAT_VALUE")}" && echo suffix-complete > "${variable("SWA_COMPAT_MARKER")}"`;

    function execute(execution: InternalExecutionSpec) {
      const child = spawnSync(execution.executable, execution.args, {
        cwd: execution.cwd,
        env: { ...process.env, ...execution.env },
        shell: false,
        windowsVerbatimArguments: execution.windowsVerbatimArguments,
        encoding: "utf8",
        timeout: 5000,
      });
      expect(child.error).toBeUndefined();
      expect(child.status, child.stderr).toBe(0);
      const record = JSON.parse(fs.readFileSync(report, "utf8").trim());
      return { execPath: record.execPath, args: record.args, cwd: record.cwd, suffixCompleted: fs.existsSync(marker) };
    }

    const expected = {
      execPath: process.execPath,
      args: ["--cors", "*", "--port", "7071", "--file", file, "--cert", process.env.SWA_COMPAT_CERT, "--name", "expanded two words"],
      cwd: fs.realpathSync(api),
      suffixCompleted: true,
    };
    // Positive control: the baseline raw suffix is executed by the actual trusted OS shell.
    expect(execute(createShellExecutionSpec(`"${process.execPath}" start --cors "*" --port 7071 ${suffix}`, api))).toEqual(expected);
    fs.writeFileSync(report, "");
    fs.unlinkSync(marker);

    await start({
      ...DEFAULT_CONFIG,
      appLocation: api,
      apiLocation: api,
      dataApiLocation: undefined,
      outputLocation: ".",
      apiPort: 7071,
      ssl: false,
      funcArgs: suffix,
    });
    const execution = vi.mocked(superviseProcesses).mock.calls[0]?.[0].find((command) => command.name === "api")?.execution;
    expect(execution).toBeDefined();
    if (!execution) throw new Error("start did not schedule the Functions fixture.");
    expect(execute(execution)).toEqual(expected);
  });
});
