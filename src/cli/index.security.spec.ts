import { childProcess, directLaunches, mockInternalProcesses } from "../../tests/_mocks/internal-process.js";
import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import process from "node:process";
import path from "node:path";
import { swaMagic } from "./index.js";
import { getCurrentSwaCliConfigFromFile } from "../core/utils/cli-config.js";
import { promptOrUseDefault } from "../core/prompts.js";

// Keep the test at swaMagic's public boundary without importing login,
// credential stores, HTTP servers, or SSL initialization.
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("./commands/deploy/register.js", () => ({ default: vi.fn() }));
vi.mock("./commands/init/register.js", () => ({ default: vi.fn() }));
vi.mock("./commands/login/register.js", () => ({ default: vi.fn() }));
vi.mock("./commands/start/register.js", () => ({ default: vi.fn() }));
vi.mock("./commands/build/register.js", () => ({ default: vi.fn() }));
vi.mock("./commands/db/init/register.js", () => ({ default: vi.fn() }));
vi.mock("./commands/docs.js", () => ({ registerDocs: vi.fn() }));
vi.mock("../core/utils/update-notifier.js", () => ({ notifyOnUpdate: vi.fn() }));
vi.mock("../core/func-core-tools.js", () => ({ getNodeMajorVersion: () => 20 }));
vi.mock("../core/utils/options.js", () => ({ configureOptions: vi.fn() }));
vi.mock("../core/utils/cli-config.js", () => ({ getCurrentSwaCliConfigFromFile: vi.fn(), swaCliConfigFilename: "swa-cli.config.json" }));
vi.mock("../core/prompts.js", () => ({ promptOrUseDefault: vi.fn() }));
vi.mock("../core/utils/logger.js", () => ({ logger: { log: vi.fn(), error: vi.fn() } }));

describe("magic-flow same-installation reentry", () => {
  beforeEach(() => {
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

  it.each([false, true])("captures caller PATH before project dotenv and preserves it across reentry (present=%s)", async (present) => {
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
      vi.spyOn(process, "cwd").mockReturnValue(project);
      vi.stubEnv("PATH", present ? inherited : "");
      if (!present) delete process.env.PATH;
      vi.stubEnv("SWA_CLI_INTERNAL_PATH_ABSENT", "");
      delete process.env.SWA_CLI_INTERNAL_PATH_ABSENT;
      childProcess.spawnSync.mockReturnValue({ status: 0, stdout: "/usr/bin:/bin", stderr: "" });
      vi.mocked(dotenv.config).mockImplementation(() => {
        process.env.PATH = injected;
        return { parsed: { PATH: injected } };
      });
      for (let generation = 0; generation < 2; generation++) {
        vi.resetModules();
        const cli = await import("./index.js");
        const resolver = await import("../core/utils/executable.js");
        expect(process.env.PATH).toBe(injected);
        expect(resolver.resolveTrustedExecutable(tool, { cwd: project })).toBe(present ? fs.realpathSync(path.join(inherited, filename)) : undefined);
        if (generation === 0) {
          await cli.swaMagic({} as SWACLIConfig);
          const child = directLaunches().find(({ file, args }) => file === process.execPath && args?.includes("init"));
          const env = child?.options?.env;
          if (!env) throw new Error("Magic reentry did not provide its prepared environment.");
          const value = process.platform === "win32" ? env.Path ?? env.PATH : env.PATH;
          expect(value).toBe(present ? inherited : process.platform === "win32" ? "" : undefined);
          expect(env.SWA_CLI_INTERNAL_PATH_ABSENT).toBe(!present && process.platform === "win32" ? "1" : undefined);
          vi.stubEnv("PATH", value ?? "");
          if (value === undefined) delete process.env.PATH;
          vi.stubEnv("SWA_CLI_INTERNAL_PATH_ABSENT", env.SWA_CLI_INTERNAL_PATH_ABSENT ?? "");
          if (env.SWA_CLI_INTERNAL_PATH_ABSENT === undefined) delete process.env.SWA_CLI_INTERNAL_PATH_ABSENT;
        }
      }
    } finally {
      fs.rmSync(sandbox, { recursive: true });
    }
  });
});
