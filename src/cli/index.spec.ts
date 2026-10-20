import { childProcess, directLaunches, mockInternalProcesses } from "../../tests/_mocks/internal-process.js";
import { fs, vol } from "memfs";
import { program } from "commander";
import fsNative from "node:fs";
import os from "node:os";
import process from "node:process";
import path from "node:path";
import { loadPackageJson } from "../core/utils/json.js";

const pkg = loadPackageJson();
const magicDependencies = [
  "dotenv",
  "./commands/deploy/register.js",
  "./commands/init/register.js",
  "./commands/login/register.js",
  "./commands/start/register.js",
  "./commands/build/register.js",
  "./commands/db/init/register.js",
  "./commands/docs.js",
  "../core/utils/update-notifier.js",
  "../core/func-core-tools.js",
  "../core/utils/options.js",
  "../core/utils/cli-config.js",
  "../core/prompts.js",
  "../core/utils/logger.js",
];

const originalConsoleError = console.error;

const expectedConfig = {
  appBuildCommand: "npm run something",
  appLocation: "app",
  auto: false,
  config: "swa-cli.config.json",
  outputLocation: ".",
  printConfig: false,
  verbose: "log",
};

describe("cli", () => {
  let run: typeof import("./index.js").run;
  let builder: typeof import("./commands/build/build.js");

  beforeAll(async () => {
    // Load the real command registration once; magic-flow stubs must not replace it.
    vi.resetModules();
    for (const module of magicDependencies) vi.doUnmock(module);
    vi.doMock("node:fs");
    vi.doMock("node:fs/promises", async () => {
      const memfs: { fs: typeof fs } = await vi.importActual("memfs");
      return memfs.fs.promises;
    });
    ({ run } = await import("./index.js"));
    builder = await import("./commands/build/build.js");
  });

  beforeEach(() => {
    vol.reset();
    program.exitOverride();
    console.error = vi.fn();
    vi.spyOn(builder, "build").mockResolvedValue();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("should print version", async () => {
    expect(run(["node", "swa", "-v"])).rejects.toThrow(pkg.version);
  });

  it("should ignore empty spaces when using positional argument", async () => {
    await run(["node", "swa", "build", "   app  ", "--app-build-command", "npm run something"]);
    expect(builder.build).toHaveBeenCalledWith({ ...expectedConfig, appLocation: "app" });
  });

  it("should not interpret empty spaces as a positional argument", async () => {
    await run(["node", "swa", "build", "    ", "--app-build-command", "npm run something", "   "]);
    expect(builder.build).toHaveBeenCalledWith({ ...expectedConfig, appLocation: "." });
  });
});

describe("magic-flow same-installation reentry", () => {
  const fs = fsNative;
  let dotenv: typeof import("dotenv");
  let swaMagic: typeof import("./index.js").swaMagic;
  let getCurrentSwaCliConfigFromFile: typeof import("../core/utils/cli-config.js").getCurrentSwaCliConfigFromFile;
  let promptOrUseDefault: typeof import("../core/prompts.js").promptOrUseDefault;

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock("node:fs");
    vi.doUnmock("node:fs/promises");
    // Keep reentry tests isolated from login, credential stores, servers and SSL.
    vi.doMock("dotenv", () => ({ default: { config: vi.fn() } }));
    for (const module of magicDependencies.slice(1, 7)) vi.doMock(module, () => ({ default: vi.fn() }));
    vi.doMock("./commands/docs.js", () => ({ registerDocs: vi.fn() }));
    vi.doMock("../core/utils/update-notifier.js", () => ({ notifyOnUpdate: vi.fn() }));
    vi.doMock("../core/func-core-tools.js", () => ({ getNodeMajorVersion: () => 20 }));
    vi.doMock("../core/utils/options.js", () => ({ configureOptions: vi.fn() }));
    vi.doMock("../core/utils/cli-config.js", () => ({ getCurrentSwaCliConfigFromFile: vi.fn(), swaCliConfigFilename: "swa-cli.config.json" }));
    vi.doMock("../core/prompts.js", () => ({ promptOrUseDefault: vi.fn() }));
    vi.doMock("../core/utils/logger.js", () => ({ logger: { log: vi.fn(), error: vi.fn() } }));
    ({ swaMagic } = await import("./index.js"));
    ({ default: dotenv } = await import("dotenv"));
    ({ getCurrentSwaCliConfigFromFile } = await import("../core/utils/cli-config.js"));
    ({ promptOrUseDefault } = await import("../core/prompts.js"));
    mockInternalProcesses();
    vi.spyOn(process, "cwd").mockReturnValue("/project with spaces");
    vi.mocked(getCurrentSwaCliConfigFromFile).mockReturnValue(undefined);
    vi.mocked(promptOrUseDefault).mockResolvedValue({ deploy: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reenters init, build and deploy with current Node and an absolute current-installation entrypoint", async () => {
    await swaMagic({} as SWACLIConfig);
    expect(childProcess.execSync.mock.calls.map(([command]) => command)).toEqual([]);
    const launches = directLaunches();
    expect(launches).toHaveLength(3);
    expect(launches.map((launch) => launch.args.slice(1))).toEqual([["init"], ["build"], ["deploy"]]);
    for (const launch of launches) {
      expect(launch.file).toBe(process.execPath);
      expect(path.isAbsolute(launch.args[0])).toBe(true);
      expect(launch.args[0]).toMatch(/[/\\]cli[/\\]bin\.js$/);
      expect(launch.options).toEqual(
        expect.objectContaining({
          cwd: "/project with spaces",
          env: expect.objectContaining({ SWA_CLI_INTERNAL_COMMAND: "1" }),
        }),
      );
    }
    expect(new Set(launches.map((launch) => launch.args[0])).size).toBe(1);
  });

  it("preserves the configured-project and declined-deploy branches", async () => {
    vi.mocked(getCurrentSwaCliConfigFromFile).mockReturnValue({ appLocation: "." } as any);
    vi.mocked(promptOrUseDefault).mockResolvedValue({ deploy: false });
    await swaMagic({} as SWACLIConfig);
    // Both baseline shell calls and future direct calls are intercepted.
    const commands = [
      ...childProcess.execSync.mock.calls.map(([command]) => command),
      ...directLaunches().map((launch) => launch.args.slice(1).join(" ")),
    ];
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatch(/(?:^| )build$/);
  });

  it.each([false, true])("honors operation-effective configured PATH after dotenv without adding off-PATH CWD (present=%s)", async (present) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "swa-entry-provenance-"));
    try {
      const project = path.join(sandbox, "project");
      const injected = path.join(project, "tools");
      const inherited = path.join(sandbox, "caller tools");
      const tool = "swa-path-fixture";
      const filename = process.platform === "win32" ? `${tool}.exe` : tool;
      fs.mkdirSync(injected, { recursive: true });
      fs.mkdirSync(inherited);
      fs.writeFileSync(path.join(injected, filename), "inert project fixture", { mode: 0o755 });
      fs.writeFileSync(path.join(inherited, filename), "inert caller fixture", { mode: 0o755 });
      fs.writeFileSync(path.join(project, filename), "inert off-PATH CWD canary", { mode: 0o755 });
      vi.spyOn(process, "cwd").mockReturnValue(project);
      vi.stubEnv("PATH", present ? inherited : "");
      if (!present) delete process.env.PATH;
      childProcess.spawnSync.mockReturnValue({ status: 0, stdout: "/usr/bin:/bin", stderr: "" });
      vi.mocked(dotenv.config).mockImplementation(() => {
        process.env.PATH = injected;
        return { parsed: { PATH: injected } };
      });
      vi.resetModules();
      const cli = await import("./index.js");
      const resolver = await import("../core/utils/executable.js");
      expect(process.env.PATH).toBe(injected);
      const selected = resolver.resolveTrustedExecutable(tool, { cwd: project });
      process.env.PATH = inherited;
      const external = resolver.resolveTrustedExecutable(tool, { cwd: project });
      process.env.PATH = injected;
      await cli.swaMagic({} as SWACLIConfig);
      const child = directLaunches().find(({ file, args }) => file === process.execPath && args?.includes("init"));
      const env = child?.options?.env;
      if (!env) throw new Error("Magic reentry did not provide its prepared environment.");
      // One configured-lookup contract, paired with the identical off-PATH canary.
      expect({
        selected,
        external,
        reentryPath: process.platform === "win32" ? env.Path ?? env.PATH : env.PATH,
        absenceMarker: env.SWA_CLI_INTERNAL_PATH_ABSENT,
      }).toEqual({
        selected: fs.realpathSync(path.join(injected, filename)),
        external: fs.realpathSync(path.join(inherited, filename)),
        reentryPath: injected,
        absenceMarker: undefined,
      });
    } finally {
      fs.rmSync(sandbox, { recursive: true });
    }
  });
});
