import { fs, vol } from "memfs";
import { program } from "commander";
import { run } from "./index.js";
import pkg from "../../package.json" with { type: "json" };
import * as builder from "./commands/build/build.js";

vi.mock("node:fs");
vi.mock("node:fs/promises", async () => {
  const memfs: { fs: typeof fs } = await vi.importActual("memfs");
  return memfs.fs.promises;
});

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
