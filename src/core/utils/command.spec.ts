import "../../../tests/_mocks/fs.js";
import "../../../tests/_mocks/posix.js";
import { childProcess, mockInternalProcesses } from "../../../tests/_mocks/internal-process.js";
import { vol, fs } from "memfs";
import { execFileCommand, runCommand } from "./command.js";
import * as fixtureFs from "node:fs";
import * as fixtureOs from "node:os";
import * as fixturePath from "node:path";
import * as fixtureProcess from "node:process";
import simulatedProcess from "node:process";
import * as fixtureUrl from "node:url";
import * as fixtureChildProcess from "node:child_process";

// Capture both module sets before collection. Native cases must not inherit the
// hoisted memfs, POSIX namespace or child-process interceptors used by unit cases.
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

describe("command execution trust boundary", () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({ "/bin/sh": "inert system-shell fixture; never executed" });
    fs.chmodSync("/bin/sh", 0o755);
    mockInternalProcesses("ok");
  });

  it.each(["dab", "tools/dab"])("rejects non-absolute internal executable %s before execution", (binary) => {
    expect(() => execFileCommand(binary, "/workspace", ["init"])).toThrow();
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it("preserves an absolute executable, explicit cwd and literal argv including spaces", () => {
    const args = ["init", "--config", "config with spaces.json", "--value", "literal&value"];
    execFileCommand("/trusted tools/dab", "/project with spaces", args);
    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      "/trusted tools/dab",
      args,
      expect.objectContaining({ cwd: "/project with spaces", stdio: "inherit", env: expect.objectContaining({ SWA_CLI_INTERNAL_COMMAND: "1" }) }),
    );
    expect(childProcess.execSync).not.toHaveBeenCalled();
  });

  it("preserves intentional customer shell commands rather than treating them as internal tools", () => {
    const command = "npm run build && npm run preview";
    runCommand(command, "/customer project");
    expect(childProcess.execSync).toHaveBeenCalledWith(
      command,
      expect.objectContaining({ cwd: "/customer project", shell: "/bin/sh", env: expect.objectContaining({ SWA_CLI_INTERNAL_COMMAND: "1" }) }),
    );
  });
});

describe("real internal argument boundary", () => {
  const fs = nativeModules["node:fs"].default;
  const os = nativeModules["node:os"].default;
  const path = nativeModules["node:path"].default;
  const process = nativeModules["node:process"].default;
  const { fileURLToPath } = nativeModules["node:url"];
  let execInternalCommand: typeof import("./command.js").execInternalCommand;
  let createToolShellExecutionSpec: typeof import("./executable.js").createToolShellExecutionSpec;
  let prepareExecution: typeof import("./executable.js").prepareExecution;
  let sandbox: string;
  let report: string;
  const recorder = fileURLToPath(new URL("../../../tests/fixtures/compatibility-recorder.cjs", import.meta.url));

  beforeEach(async () => {
    vi.resetModules();
    for (const [name, module] of Object.entries(nativeModules)) vi.doMock(name, () => module);
    vi.doMock("fs", () => nativeModules["node:fs"]);
    vi.doMock("child_process", () => nativeModules["node:child_process"]);
    vi.stubGlobal("process", process);
    ({ execInternalCommand } = await import("./command.js"));
    ({ createToolShellExecutionSpec, prepareExecution } = await import("./executable.js"));
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swa argv-boundary-"));
    report = path.join(sandbox, "observed argv.json");
    fs.writeFileSync(report, "");
    vi.stubEnv("SWA_COMPAT_REPORT", report);
    vi.stubEnv("SWA_COMPAT_EXIT", "0");
    vi.stubEnv("SWA_COMPAT_VALUE", "expanded two words");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(sandbox, { recursive: true });
    for (const [name, module] of Object.entries(fixtureModules)) vi.doMock(name, () => module);
    vi.doMock("fs", () => fixtureFs);
    vi.doMock("child_process", () => fixtureChildProcess);
    vi.stubGlobal("process", simulatedProcess);
  });

  it.each(["native", "bound shell"])("keeps fixed UNC, space, quote and metacharacter argv literal through %s execution", (mode) => {
    const args = [
      "--cert",
      String.raw`\\fileserver\devcerts\local.pfx`,
      "--spaced-cert",
      String.raw`\\fileserver\dev certs\local.pfx`,
      "--drive",
      String.raw`C:\dev certs\local.pfx`,
      "two words",
      'say "hello"',
      "single 'quoted'",
      "",
      "trailing\\",
      "$SWA_COMPAT_VALUE",
      "%SWA_COMPAT_VALUE%",
      "*.json",
      ";",
      "&&",
      ">",
    ];
    const execution =
      mode === "native"
        ? prepareExecution({ executable: process.execPath, args: [recorder, ...args], cwd: sandbox })
        : createToolShellExecutionSpec(process.execPath, [recorder, ...args], sandbox);

    execInternalCommand(execution);

    const record: { execPath: string; args: string[]; cwd: string } = JSON.parse(fs.readFileSync(report, "utf8"));
    expect({ execPath: record.execPath, args: record.args, cwd: record.cwd }).toEqual({
      execPath: process.execPath,
      args,
      cwd: fs.realpathSync(sandbox),
    });
  });

  it("rejects a null byte at the actual native execution boundary before the recorder runs", () => {
    const execution = prepareExecution({ executable: process.execPath, args: [recorder, "before\0after"], cwd: sandbox });
    expect(() => execInternalCommand(execution)).toThrow(/null bytes/);
    expect(fs.readFileSync(report, "utf8")).toBe("");
  });
});
