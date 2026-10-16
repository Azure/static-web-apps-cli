import "../../tests/_mocks/fs.js";
import "../../tests/_mocks/posix.js";
import { childProcess, directLaunches, mockInternalProcesses } from "../../tests/_mocks/internal-process.js";
import { vol, fs } from "memfs";
import os from "node:os";
import process from "node:process";
import path from "node:path";
import { getCoreToolsBinary, resetCachedInstalledSystemCoreToolsVersion } from "./func-core-tools.js";
import { installAndGetDataApiBuilder } from "./dataApiBuilder/dab.js";
import { fetchWithProxy } from "./utils/fetch-proxy.js";
import { downloadAndValidateBinary } from "./download-binary-helper.js";
import { DATA_API_BUILDER_FOLDER, DEFAULT_DATA_API_BUILDER_BINARY } from "./constants.js";

vi.mock("./utils/fetch-proxy.js", () => ({ fetchWithProxy: vi.fn() }));
vi.mock("./download-binary-helper.js", () => ({ downloadAndValidateBinary: vi.fn() }));
vi.mock("./utils/logger.js", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), silly: vi.fn(), info: vi.fn() },
}));

describe("internal executable identity (no fixture execution)", () => {
  beforeEach(() => {
    vol.reset();
    resetCachedInstalledSystemCoreToolsVersion();
    vi.spyOn(os, "platform").mockReturnValue("linux");
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    vi.spyOn(process, "cwd").mockReturnValue("/workspace");
    // CWD, empty and relative entries are not trusted internal tool roots.
    vi.stubEnv("PATH", "/workspace:.:relative-tools::/trusted/bin");
    vol.fromJSON({
      "/workspace/func": "inert fixture",
      "/workspace/dab": "inert fixture",
      "/workspace/relative-tools/func": "inert fixture",
      "/workspace/relative-tools/dab": "inert fixture",
      "/trusted/bin/func": "inert fixture",
      "/trusted/bin/dab": "inert fixture",
    });
    for (const file of Object.keys(vol.toJSON())) fs.chmodSync(file, 0o755);
    vi.mocked(fetchWithProxy).mockResolvedValue({
      json: async () => [{ version: "latest", versionId: "1.2.3" }],
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetCachedInstalledSystemCoreToolsVersion();
  });

  it("probes installed Functions with an absolute executable and argv, not a shell", async () => {
    mockInternalProcesses("4.0.0");
    await getCoreToolsBinary();
    expect(childProcess.exec.mock.calls).toEqual([]);
    expect(directLaunches()).toContainEqual(expect.objectContaining({ file: "/trusted/bin/func", args: ["--version"] }));
  });

  it("returns the same trusted Functions identity selected for probing", async () => {
    mockInternalProcesses("4.0.0");
    const binary = await getCoreToolsBinary();
    expect(binary).toBe("/trusted/bin/func");
  });

  it("preserves absolute cached Functions downloads when no compatible installed version exists", async () => {
    mockInternalProcesses("2.0.0");
    vol.fromJSON({
      "/home/tester/.swa/core-tools/v4/.release-version": "4.3.2",
      "/home/tester/.swa/core-tools/v4/func": "inert fixture",
    });
    const binary = await getCoreToolsBinary();
    expect(binary).toBe("/home/tester/.swa/core-tools/v4/func");
  });

  it("probes installed DAB with an absolute executable and argv, not a shell", async () => {
    mockInternalProcesses("Microsoft.DataApiBuilder 1.2.3\r\n");
    await installAndGetDataApiBuilder();
    expect(childProcess.exec.mock.calls).toEqual([]);
    expect(directLaunches()).toContainEqual(expect.objectContaining({ file: "/trusted/bin/dab", args: ["--version"] }));
  });

  it("returns the same trusted DAB identity selected for probing", async () => {
    mockInternalProcesses("Microsoft.DataApiBuilder 1.2.3\r\n");
    const result = await installAndGetDataApiBuilder();
    expect(result.binaryPath).toBe("/trusted/bin/dab");
  });

  it("fails closed when DAB probing and download both fail instead of returning a bare name", async () => {
    mockInternalProcesses("", new Error("not installed"));
    vi.mocked(downloadAndValidateBinary).mockRejectedValue(new Error("offline"));
    await expect(installAndGetDataApiBuilder()).rejects.toThrow();
  });

  it("preserves the absolute cached DAB download when the installed version is outdated", async () => {
    mockInternalProcesses("Microsoft.DataApiBuilder 0.1.0\r\n");
    const binaryPath = path.join(DATA_API_BUILDER_FOLDER, "1.2.3", DEFAULT_DATA_API_BUILDER_BINARY.Linux);
    vol.fromJSON({ [binaryPath]: "inert fixture" });
    const result = await installAndGetDataApiBuilder();
    expect(result.binaryPath).toBe(binaryPath);
  });
});
