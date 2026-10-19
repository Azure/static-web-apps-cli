import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG } from "../../../config.js";
import { createShellExecutionSpec, InternalExecutionSpec } from "../../../core/utils/executable.js";
import { superviseProcesses } from "../../../core/utils/process.js";
import { start } from "./start.js";

vi.mock("../../../core/utils/process.js", () => ({ superviseProcesses: vi.fn() }));
vi.mock("../../../core/utils/net.js", () => ({ isAcceptingTcpConnections: async () => 4280, askNewPort: vi.fn(), parseUrl: vi.fn() }));
vi.mock("../../../core/utils/workflow-config.js", () => ({
  readWorkflowFile: ({ userWorkflowConfig }: { userWorkflowConfig: object }) => userWorkflowConfig,
}));
vi.mock("../../../core/func-core-tools.js", () => ({
  getCoreToolsBinary: async () => process.execPath,
  getNodeMajorVersion: () => 20,
  detectTargetCoreToolsVersion: () => 4,
  isCoreToolsVersionCompatible: () => true,
}));
vi.mock("../../../core/ssl.js", () => ({ getCertificate: vi.fn() }));
vi.mock("../../../core/utils/logger.js", () => ({
  logger: { silly: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

describe("Functions raw shell suffix compatibility (benign native argv recorder)", () => {
  let sandbox: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swa-suffix-compat-"));
    originalEnv = { ...process.env };
    vi.mocked(superviseProcesses).mockResolvedValue([]);
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(sandbox, { recursive: true });
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
