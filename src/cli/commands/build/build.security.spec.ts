import "../../../../tests/_mocks/fs.js";
import "../../../../tests/_mocks/posix.js";
import { childProcess, directLaunches, mockInternalProcesses } from "../../../../tests/_mocks/internal-process.js";
import { vol, fs } from "memfs";
import process from "node:process";
import { build } from "./build.js";
import { DEFAULT_CONFIG } from "../../../config.js";

vi.mock("../../../core/utils/workflow-config.js", () => ({ readWorkflowFile: () => undefined }));
vi.mock("../../../core/utils/options.js", () => ({ isUserOrConfigOption: () => false }));
vi.mock("../../../core/utils/file.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../core/utils/file.js")>()),
  // Isolate installation policy from the unrelated finder, which strips
  // the leading slash from absolute paths in the current implementation.
  findUpPackageJsonDir: async () => "/workspace/app",
}));
vi.mock("../../../core/utils/logger.js", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), silly: vi.fn() },
}));
vi.mock("../../../core/frameworks/detect.js", () => ({ detectProjectFolders: vi.fn(), generateConfiguration: vi.fn() }));

describe("automatic dependency installs are internal, user build strings are deliberate", () => {
  beforeEach(() => {
    vol.reset();
    mockInternalProcesses();
    vi.spyOn(process, "cwd").mockReturnValue("/workspace");
    vi.stubEnv("PATH", "/trusted/bin");
    vol.fromJSON({
      "/bin/sh": "inert system-shell fixture; never executed",
      "/workspace/app/package.json": "{}",
      "/trusted/bin/npm": "inert fixture",
      "/trusted/bin/yarn": "inert fixture",
      "/trusted/bin/pnpm": "inert fixture",
      "/workspace/npm": "inert fixture",
      "/workspace/yarn": "inert fixture",
      "/workspace/pnpm": "inert fixture",
      "/workspace/app/npm": "inert off-PATH fixture",
      "/workspace/app/yarn": "inert off-PATH fixture",
      "/workspace/app/pnpm": "inert off-PATH fixture",
      "/workspace/app/.tools/npm": "inert configured fixture",
      "/workspace/app/.tools/yarn": "inert configured fixture",
      "/workspace/app/.tools/pnpm": "inert configured fixture",
    });
    for (const file of Object.keys(vol.toJSON())) fs.chmodSync(file, 0o755);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["npm", "package-lock.json"],
    ["yarn", "yarn.lock"],
    ["pnpm", "pnpm-lock.yaml"],
  ])("runs automatic %s install through the caller-selected identity without off-PATH CWD preemption", async (manager, lock) => {
    vol.fromJSON({ [`/workspace/app/${lock}`]: "" });
    for (const directory of ["/trusted/bin", "/workspace/app/.tools"]) {
      vi.stubEnv("PATH", directory === "/trusted/bin" ? directory : `${directory}:/trusted/bin`);
      await build({ ...DEFAULT_CONFIG, appLocation: "/workspace/app", outputLocation: ".", appBuildCommand: "npm run build && echo done" });
      expect(childProcess.execSync.mock.calls.map(([command]) => command)).not.toContain(`${manager} install`);
      const launches = directLaunches().map(({ file, args, options }) => ({ file, args, cwd: options?.cwd }));
      expect(launches).toContainEqual({ file: `${directory}/${manager}`, args: ["install"], cwd: "/workspace/app" });
      expect(launches.some(({ file }) => file === `/workspace/app/${manager}` || file === `/workspace/${manager}`)).toBe(false);
    }
  });

  it("preserves an explicit user build command as a shell string", async () => {
    const command = "npm run build && echo done";
    await build({ ...DEFAULT_CONFIG, appLocation: "/workspace/app", outputLocation: ".", appBuildCommand: command });
    expect(childProcess.execSync).toHaveBeenCalledWith(command, expect.objectContaining({ cwd: "/workspace/app", shell: "/bin/sh" }));
  });
});
