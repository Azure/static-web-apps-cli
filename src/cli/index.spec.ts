import { fs, vol } from "memfs";
import { program } from "commander";
import { run } from "./index.js";
import pkg from "../../package.json" with { type: "json" };

vi.mock("node:fs");
vi.mock("node:fs/promises", async () => {
  const memfs: { fs: typeof fs } = await vi.importActual("memfs");
  return memfs.fs.promises;
});

const buildMock = vi.fn();
vi.mock("./commands/build/build", () => ({
  build: buildMock,
}));

const originalConsoleError = console.error;

describe("cli", () => {
  beforeEach(() => {
    vol.reset();
    program.exitOverride();
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("should print version", async () => {
    expect(run(["node", "swa", "-v"])).rejects.toThrow(pkg.version);
  });

  it("should ignore empty spaces when using positional argument", async () => {
    await run(["node", "swa", "build", "   app  ", "--app-build-command", "npm run something"]);
    expect(buildMock).toHaveBeenCalledWith({ appLocation: "app" });
  });

  it("should not interpret empty spaces as a positional argument", async () => {
    await run(["node", "swa", "build", "    ", "--app-build-command", "npm run something", "   "]);
    expect(buildMock).toHaveBeenCalledWith({ appLocation: "." });
  });
});
