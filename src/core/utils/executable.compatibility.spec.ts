import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { execInternalCommand } from "./command.js";
import {
  createShellExecutionSpec,
  InternalExecutionSpec,
  prepareExecution,
  probeExecutable,
  resolveTrustedExecutable,
  resolveTrustedPackageManager,
} from "./executable.js";

const recorder = fileURLToPath(new URL("../../../tests/fixtures/compatibility-recorder.cjs", import.meta.url));
const windows = process.platform === "win32";

describe("trusted external wrapper compatibility (benign native fixtures)", () => {
  let sandbox: string;
  let project: string;
  let external: string;
  let report: string;
  let output: string;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swa-wrapper-compat-"));
    project = path.join(sandbox, "project with spaces");
    external = path.join(sandbox, "external tools");
    report = path.join(sandbox, "launches.jsonl");
    output = path.join(sandbox, "wrapper stdout.txt");
    fs.mkdirSync(project);
    fs.mkdirSync(external);
    fs.copyFileSync(recorder, path.join(external, "record.cjs"));
    vi.stubEnv("PATH", [project, external, path.dirname(process.execPath)].join(path.delimiter));
    vi.stubEnv("SWA_COMPAT_REPORT", report);
    vi.stubEnv("SWA_COMPAT_CONTEXT", "inherited context");
    for (const key of ["SWA_COMPAT_WRAPPER", "SWA_COMPAT_PROBE", "SWA_COMPAT_EXIT", "NoDefaultCurrentDirectoryInExePath"]) {
      vi.stubEnv(key, "");
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(sandbox, { recursive: true });
  });

  function wrapper(
    name: string,
    redirect = false,
    exit = 0,
    nestedNode = false,
    location = { directory: external, marker: "trusted external wrapper" },
  ) {
    const file = path.join(location.directory, windows ? `${name}.cmd` : name);
    const script = path.join(external, "record.cjs");
    const redirectOutput = redirect ? ` > "${output}"` : "";
    fs.writeFileSync(
      file,
      windows
        ? [
            "@ECHO OFF",
            "SETLOCAL",
            `SET "SWA_COMPAT_WRAPPER=${location.marker}"`,
            `SET "SWA_COMPAT_EXIT=${exit}"`,
            ...(nestedNode
              ? [
                  'SET "NODE_EXE=%~dp0node.exe"',
                  'IF NOT EXIST "%NODE_EXE%" SET "NODE_EXE=node"',
                  `FOR /F "delims=" %%F IN ('CALL "%NODE_EXE%" "${script}" --version') DO SET "SWA_COMPAT_PROBE=%%F"`,
                ]
              : [`SET "NODE_EXE=${process.execPath}"`]),
            `CALL "%NODE_EXE%" "${script}" --wrapper-flag %*${redirectOutput}`,
            "EXIT /B %ERRORLEVEL%",
            "",
          ].join("\r\n")
        : `#!/bin/sh\nSWA_COMPAT_WRAPPER="${location.marker}" SWA_COMPAT_EXIT=${exit} ${nestedNode ? "node" : `"${process.execPath}"`} "${script}" --wrapper-flag "$@"${redirectOutput}\n`,
      { mode: 0o755 },
    );
    return fs.realpathSync(file);
  }

  function packageEntrypoint() {
    const root = path.join(external, "node_modules", "npm");
    fs.mkdirSync(path.join(root, "bin"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "npm", bin: { npm: "bin/npm-cli.js" } }));
    fs.copyFileSync(recorder, path.join(root, "bin", "npm-cli.js"));
  }

  function records(): { execPath: string; args: string[]; cwd: string; wrapper: string | null; probe: string | null; context: string }[] {
    return fs
      .readFileSync(report, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }

  function executeWithStatus(execution: InternalExecutionSpec): number {
    try {
      execInternalCommand(execution);
      return 0;
    } catch (error) {
      if (!(error instanceof Error) || !("status" in error) || typeof error.status !== "number") throw error;
      return error.status;
    }
  }

  it("executes the selected package wrapper instead of bypassing its flags, redirection, env and exit status", () => {
    const selected = wrapper("npm", true, 17);
    packageEntrypoint();
    const control = createShellExecutionSpec(`"${selected}" install`, project);
    const child = spawnSync(control.executable, control.args, {
      cwd: control.cwd,
      env: process.env,
      shell: false,
      windowsVerbatimArguments: control.windowsVerbatimArguments,
      timeout: 5000,
    });
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(17);
    expect(records().at(-1)).toMatchObject({ args: ["--wrapper-flag", "install"], wrapper: "trusted external wrapper" });
    expect(fs.readFileSync(output, "utf8").trim()).toBe("compatibility wrapper stdout");
    fs.writeFileSync(report, "");
    fs.unlinkSync(output);
    const execution = resolveTrustedPackageManager("npm");
    const status = executeWithStatus({ ...execution, args: [...execution.args, "install"], cwd: project });
    expect({
      status,
      launch: records().at(-1),
      stdout: fs.existsSync(output) ? fs.readFileSync(output, "utf8").trim() : undefined,
    }).toEqual({
      status: 17,
      launch: {
        execPath: process.execPath,
        args: ["--wrapper-flag", "install"],
        cwd: fs.realpathSync(project),
        wrapper: "trusted external wrapper",
        probe: null,
        context: "inherited context",
      },
      stdout: "compatibility wrapper stdout",
    });
  });

  it.each([
    ["func", "4.0.0"],
    ["dab", "Microsoft.DataApiBuilder 1.2.3"],
  ])("executes the same trusted %s wrapper for version probing and launch", async (tool, version) => {
    const expected = wrapper(tool);
    vi.stubEnv("SWA_COMPAT_VERSION", version);
    const resolutionOptions = {};
    const executable = resolveTrustedExecutable(tool, resolutionOptions);
    expect(executable).toBe(expected);
    if (!executable) throw new Error(`Missing fixture wrapper for ${tool}.`);
    expect((await probeExecutable(executable, ["--version"], resolutionOptions)).stdout.trim()).toBe(version);
    execInternalCommand({ executable, args: ["start"], cwd: project });
    expect(records()).toEqual([
      {
        execPath: process.execPath,
        args: ["--wrapper-flag", "--version"],
        cwd: fs.realpathSync(process.cwd()),
        wrapper: "trusted external wrapper",
        probe: null,
        context: "inherited context",
      },
      {
        execPath: process.execPath,
        args: ["--wrapper-flag", "start"],
        cwd: fs.realpathSync(project),
        wrapper: "trusted external wrapper",
        probe: null,
        context: "inherited context",
      },
    ]);
  });

  it.each([
    ["func", "4.0.0"],
    ["dab", "Microsoft.DataApiBuilder 1.2.3"],
    ["npm", "10.8.2"],
  ])("honors caller's explicit absolute project PATH order for %s probe and launch", async (tool, version) => {
    const local = path.join(project, tool === "npm" ? "node_modules/.bin" : ".tools");
    fs.mkdirSync(local, { recursive: true });
    const marker = "first caller PATH wrapper";
    const command = tool === "npm" ? "install" : "start";
    const status = tool === "npm" ? 17 : 0;
    const expected = wrapper(tool, tool === "npm", status, false, { directory: local, marker });
    wrapper(tool, tool === "npm", status);
    const callerPath = [local, external, path.dirname(process.execPath)].join(path.delimiter);
    vi.stubEnv("PATH", callerPath);
    vi.stubEnv("SWA_COMPAT_VERSION", version);
    const resolutionOptions = {};

    const baseline = createShellExecutionSpec(`"${tool}" ${command}`, project);
    const control = spawnSync(baseline.executable, baseline.args, {
      cwd: project,
      env: { ...process.env, ...baseline.env },
      shell: false,
      windowsVerbatimArguments: baseline.windowsVerbatimArguments,
      timeout: 5000,
    });
    expect(control.error).toBeUndefined();
    expect(control.status).toBe(status);
    expect(records().at(-1)?.wrapper).toBe(marker);
    fs.writeFileSync(report, "");

    const execution =
      tool === "npm"
        ? resolveTrustedPackageManager("npm", resolutionOptions)
        : { executable: resolveTrustedExecutable(tool, resolutionOptions)!, args: [] };
    const probe = await probeExecutable(execution.executable, ["--version"], resolutionOptions);
    const actualStatus = executeWithStatus({ ...execution, args: [command], cwd: project });
    const observed = records();
    expect({
      canonical: execution.executable,
      wrappers: observed.map((record) => record.wrapper),
      args: observed.map((record) => record.args),
      identities: observed.map((record) => record.execPath),
      cwds: observed.map((record) => record.cwd),
      probe: probe.stdout.trim(),
      status: actualStatus,
      callerPath: process.env.PATH,
      redirected: tool === "npm" ? fs.readFileSync(output, "utf8").trim() : undefined,
    }).toEqual({
      canonical: expected,
      wrappers: [marker, marker],
      args: [
        ["--wrapper-flag", "--version"],
        ["--wrapper-flag", command],
      ],
      identities: [process.execPath, process.execPath],
      cwds: [fs.realpathSync(process.cwd()), fs.realpathSync(project)],
      probe: tool === "npm" ? "" : version,
      status,
      callerPath,
      redirected: tool === "npm" ? "compatibility wrapper stdout" : undefined,
    });
  });

  it("binds relative caller PATH and the version probe to the tool's operation cwd", async () => {
    const runtime = path.join(project, "runtime tools");
    fs.mkdirSync(runtime);
    fs.writeFileSync(
      path.join(runtime, windows ? "node.cmd" : "node"),
      windows
        ? `@ECHO OFF\r\nSETLOCAL\r\nSET "SWA_COMPAT_CONTEXT=relative PATH loader"\r\nCALL "${process.execPath}" %*\r\nEXIT /B %ERRORLEVEL%\r\n`
        : `#!/bin/sh\nSWA_COMPAT_CONTEXT="relative PATH loader" exec "${process.execPath}" "$@"\n`,
      { mode: 0o755 },
    );
    const expected = wrapper("func", false, 0, true);
    const callerPath = [path.relative(project, external), path.relative(project, runtime)].join(path.delimiter);
    vi.stubEnv("PATH", callerPath);
    vi.stubEnv("SWA_COMPAT_VERSION", "4.0.0");
    const resolutionOptions = { cwd: project };
    const executable = resolveTrustedExecutable("func", resolutionOptions);
    expect(executable).toBe(expected);
    if (!executable) throw new Error("Missing relative PATH fixture.");
    expect((await probeExecutable(executable, ["--version"], resolutionOptions)).stdout.trim()).toBe("4.0.0");
    execInternalCommand({ executable, args: ["start"], cwd: project });
    const argv = windows
      ? [["--version"], ["--wrapper-flag", "--version"], ["--version"], ["--wrapper-flag", "start"]]
      : [
          ["--wrapper-flag", "--version"],
          ["--wrapper-flag", "start"],
        ];
    expect(records().map(({ execPath, args, cwd, context }) => ({ execPath, args, cwd, context }))).toEqual(
      argv.map((args) => ({ execPath: process.execPath, args, cwd: fs.realpathSync(project), context: "relative PATH loader" })),
    );
    expect(process.env.PATH).toBe(callerPath);
  });

  it.skipIf(!windows)(
    "native Windows: off-PATH CWD canaries cannot preempt wrappers or fixed cmd/Node loaders",
    () => {
      const resolutionOptions = { cwd: project };
      const trustedCmd = createShellExecutionSpec("echo fixture", project).executable;
      fs.copyFileSync(process.execPath, path.join(project, "node.exe"));
      fs.copyFileSync(trustedCmd, path.join(project, "cmd.exe"));
      for (const name of ["func", "dab", "npm"]) {
        wrapper(name, false, 0, false, { directory: project, marker: "off-PATH CWD canary" });
      }
      vi.stubEnv("PATH", [external, path.dirname(process.execPath)].join(path.delimiter));
      vi.stubEnv("ComSpec", path.join(project, "cmd.exe"));
      vi.stubEnv("SWA_COMPAT_VERSION", "4.0.0");
      for (const name of ["func", "dab", "npm"]) {
        const expected = wrapper(name, name === "npm", 0, true);
        fs.writeFileSync(report, "");
        const selected =
          name === "npm" ? resolveTrustedPackageManager("npm", resolutionOptions).executable : resolveTrustedExecutable(name, resolutionOptions)!;
        const prepared = prepareExecution({ executable: selected, args: ["start"], cwd: project });
        expect(prepared.executable).toBe(trustedCmd);
        expect(prepared.env?.ComSpec).toBe(trustedCmd);
        execInternalCommand(prepared);
        expect(selected).toBe(expected);
        const observed = records();
        expect(observed.map((record) => record.execPath.toLowerCase())).toEqual([process.execPath.toLowerCase(), process.execPath.toLowerCase()]);
        expect(observed.map((record) => record.cwd)).toEqual([fs.realpathSync(project), fs.realpathSync(project)]);
        expect(observed.map((record) => record.args)).toEqual([["--version"], ["--wrapper-flag", "start"]]);
        expect(observed[1].wrapper).toBe("trusted external wrapper");
        expect(observed[1].probe).toBe("4.0.0");
      }
    },
    15000,
  );

  it.skipIf(!windows)(
    "native Windows: future configured PATH aliases and global alternatives never add off-PATH CWD",
    () => {
      fs.copyFileSync(process.execPath, path.join(project, "node.exe"));
      wrapper("npm", true, 0, true);
      packageEntrypoint();
      vi.stubEnv("SWA_COMPAT_VERSION", "4.0.0");
      const alias = path.join(sandbox, "project junction");
      const missingProjectChild = path.join(alias, "created after binding");
      const futureGlobal = path.join(external, "future global");
      fs.symlinkSync(project, alias, "junction");
      vi.stubEnv("PATH", [missingProjectChild, futureGlobal, external, path.dirname(process.execPath)].join(path.delimiter));
      expect(fs.existsSync(path.join(external, "node.exe"))).toBe(false);
      const execution = resolveTrustedPackageManager("npm");
      const prepared = prepareExecution({ ...execution, args: [...execution.args, "install"], cwd: project });
      fs.mkdirSync(missingProjectChild);
      fs.linkSync(path.join(project, "node.exe"), path.join(missingProjectChild, "node.exe"));
      fs.mkdirSync(futureGlobal);
      const trustedNode = path.join(futureGlobal, "node.exe");
      fs.copyFileSync(process.execPath, trustedNode);
      vi.stubEnv("PATH", [futureGlobal, external, path.dirname(process.execPath)].join(path.delimiter));
      const alternatives = [
        { execution: prepared, node: path.join(missingProjectChild, "node.exe") },
        { execution: prepareExecution({ ...execution, args: ["install"], cwd: project }), node: trustedNode },
      ];
      for (const { execution: bound, node } of alternatives) {
        fs.writeFileSync(report, "");
        execInternalCommand(bound);
        expect(records().map((record) => ({ ...record, execPath: fs.realpathSync(record.execPath).toLowerCase() }))).toEqual([
          {
            execPath: fs.realpathSync(node).toLowerCase(),
            args: ["--version"],
            cwd: fs.realpathSync(project),
            wrapper: "trusted external wrapper",
            probe: null,
            context: "inherited context",
          },
          {
            execPath: fs.realpathSync(node).toLowerCase(),
            args: ["--wrapper-flag", "install"],
            cwd: fs.realpathSync(project),
            wrapper: "trusted external wrapper",
            probe: "4.0.0",
            context: "inherited context",
          },
        ]);
      }
    },
    15000,
  );
});
