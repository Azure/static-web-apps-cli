import { program } from "commander";
import mockFs from "mock-fs";
import { run } from "./index.js";

jest.mock("./commands/build/build", () => ({
  build: jest.fn(),
}));

const pkg = require("../../package.json");

const originalConsoleError = console.error;

describe("cli", () => {
  beforeEach(() => {
    // Throws CommanderError instead of exiting after showing version or error
    program.exitOverride();
    console.error = jest.fn();
  });

  afterEach(() => {
    mockFs.restore();
    const buildMock = jest.requireMock("./commands/build/build").build;
    buildMock.mockReset();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("should print version", async () => {
    expect(run(["node", "swa", "-v"])).rejects.toThrow(pkg.version);
  });

  it("should ignore empty spaces when using positional argument", async () => {
    const build = jest.requireMock("./commands/build/build").build;
    mockFs();
    await run(["node", "swa", "build", "   app  ", "--app-build-command", "npm run something"]);
    expect(build.mock.calls[0][0].appLocation).toBe("app");
  });

  it("should not interpret empty spaces as a positional argument", async () => {
    const build = jest.requireMock("./commands/build/build").build;
    mockFs();
    await run(["node", "swa", "build", "    ", "--app-build-command", "npm run something", "   "]);
    expect(build.mock.calls[0][0].appLocation).toBe(".");
  });
});
