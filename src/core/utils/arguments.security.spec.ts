import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { execInternalCommand } from "./command.js";
import { createToolShellExecutionSpec, prepareExecution } from "./executable.js";

describe("real internal argument boundary", () => {
  let sandbox: string;
  let report: string;
  const recorder = fileURLToPath(new URL("../../../tests/fixtures/compatibility-recorder.cjs", import.meta.url));

  beforeEach(() => {
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
