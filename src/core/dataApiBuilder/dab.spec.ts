import "../../../tests/_mocks/fs.js";
import "../../../tests/_mocks/posix.js";
import { childProcess, directLaunches, mockInternalProcesses } from "../../../tests/_mocks/internal-process.js";
import { vol, fs } from "memfs";
import os from "node:os";
import process from "node:process";
import path from "node:path";
import { DATA_API_BUILDER_FOLDER, DEFAULT_DATA_API_BUILDER_BINARY } from "../constants.js";
import { getDefaultDataApiBuilderBinaryForOS } from "./dab.js";

describe("getDefaultDataApiBuilderBinaryForOS", () => {
  it("returns the default binary for Windows when given win-x64 platform", () => {
    const platform = "win-x64";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.Windows;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });

  it("returns the default binary for macOS when given osx-x64 platform", () => {
    const platform = "osx-x64";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.MacOs;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });

  it("returns the default binary for Linux when given linux-x64 platform", () => {
    const platform = "linux-x64";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.Linux;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });

  it("returns the default binary for Windows when given an unsupported platform", () => {
    const platform = "foo-bar";
    const expectedBinary = DEFAULT_DATA_API_BUILDER_BINARY.Windows;

    expect(getDefaultDataApiBuilderBinaryForOS(platform)).toEqual(expectedBinary);
  });
});

describe("internal executable identity (no fixture execution)", () => {
  let installAndGetDataApiBuilder: typeof import("./dab.js").installAndGetDataApiBuilder;
  let downloadAndValidateBinary: typeof import("../download-binary-helper.js").downloadAndValidateBinary;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("../utils/fetch-proxy.js", () => ({ fetchWithProxy: vi.fn() }));
    vi.doMock("../download-binary-helper.js", () => ({ downloadAndValidateBinary: vi.fn() }));
    vi.doMock("../utils/logger.js", () => ({
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), silly: vi.fn(), info: vi.fn() },
    }));
    ({ installAndGetDataApiBuilder } = await import("./dab.js"));
    ({ downloadAndValidateBinary } = await import("../download-binary-helper.js"));
    vol.reset();
    vi.spyOn(os, "platform").mockReturnValue("linux");
    vi.spyOn(os, "homedir").mockReturnValue("/home/tester");
    vi.spyOn(process, "cwd").mockReturnValue("/workspace");
    vi.stubEnv("PATH", "/trusted/bin");
    vol.fromJSON({
      "/workspace/func": "inert fixture",
      "/workspace/dab": "inert fixture",
      "/workspace/relative-tools/func": "inert fixture",
      "/workspace/relative-tools/dab": "inert fixture",
      "/trusted/bin/func": "inert fixture",
      "/trusted/bin/dab": "inert fixture",
    });
    for (const file of Object.keys(vol.toJSON())) fs.chmodSync(file, 0o755);
    const { fetchWithProxy } = await import("../utils/fetch-proxy.js");
    vi.mocked(fetchWithProxy).mockResolvedValue({
      json: async () => [{ version: "latest", versionId: "1.2.3" }],
    } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("probes installed DAB with an absolute executable and argv, not a shell", async () => {
    mockInternalProcesses("Microsoft.DataApiBuilder 1.2.3\r\n");
    await installAndGetDataApiBuilder();
    expect(childProcess.exec.mock.calls).toEqual([]);
    expect(directLaunches()).toContainEqual(expect.objectContaining({ file: "/trusted/bin/dab", args: ["--version"] }));
  });

  it("returns the same trusted DAB identity selected for probing", async () => {
    vi.stubEnv("PATH", "/workspace/relative-tools:/trusted/bin");
    mockInternalProcesses("Microsoft.DataApiBuilder 1.2.3\r\n");
    const result = await installAndGetDataApiBuilder();
    expect(result.binaryPath).toBe("/workspace/relative-tools/dab");
    expect(directLaunches()).toContainEqual(expect.objectContaining({ file: result.binaryPath, args: ["--version"] }));
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
