import { afterAll, vi } from "vitest";
import process from "node:process";

// Import only in suites with POSIX fixtures, before importing the code under test.
// os.platform alone leaves native Windows path operations and captured constants
// inconsistent with those fixtures. This is simulation, not native Windows proof.
const fixture = vi.hoisted(() => ({
  cwd: undefined,
  // memfs uses the same drive-free, slash-separated namespace on Windows.
  path: (file) => file.replace(/\\/g, "/").replace(/^[a-z]:/i, ""),
}));
export { fixture as posix };

vi.mock("node:process", async (importOriginal) => {
  const actual = await importOriginal();
  // Keep inherited EventEmitter APIs (on/removeListener are not own properties).
  const process = Object.assign(Object.create(actual.default), {
    cwd: () => fixture.cwd ?? fixture.path(actual.default.cwd()),
    execPath: fixture.path(actual.default.execPath),
  });
  // Match named and default imports, including module-time cwd capture.
  return { ...actual, cwd: process.cwd, execPath: process.execPath, default: process };
});

// Some CLI modules use global process, others import it. They must share env,
// execPath and exit spies. This is worker-local and restored after the suite.
vi.stubGlobal("process", process);
afterAll(() => vi.unstubAllGlobals());

vi.mock("node:path", async (importOriginal) => {
  const actual = await importOriginal();
  const process = (await import("node:process")).default;
  const path = {
    ...actual.posix,
    resolve: (...parts) => actual.posix.resolve(process.cwd(), ...parts),
    // Keep explicit Windows simulation available to the shim identity cases.
    win32: actual.win32,
  };
  return { ...path, default: path };
});

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal();
  const os = {
    ...actual.default,
    platform: () => "linux",
    homedir: () => fixture.path(actual.default.homedir()),
  };
  return { ...actual, ...os, default: os };
});

vi.mock("node:url", async (importOriginal) => {
  const actual = await importOriginal();
  const fileURLToPath = (...args) => fixture.path(actual.fileURLToPath(...args));
  return { ...actual, fileURLToPath, default: { ...actual.default, fileURLToPath } };
});
