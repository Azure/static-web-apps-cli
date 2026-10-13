import { childProcess, mockInternalProcesses } from "../../../tests/_mocks/internal-process.js";
import { execFileCommand, runCommand } from "./command.js";

describe("command execution trust boundary", () => {
  beforeEach(() => mockInternalProcesses("ok"));

  it.each(["dab", "tools/dab"])("rejects non-absolute internal executable %s before execution", (binary) => {
    expect(() => execFileCommand(binary, "/workspace", ["init"])).toThrow();
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it("preserves an absolute executable, explicit cwd and literal argv including spaces", () => {
    const args = ["init", "--config", "config with spaces.json", "--value", "literal&value"];
    execFileCommand("/trusted tools/dab", "/project with spaces", args);
    expect(childProcess.execFileSync).toHaveBeenCalledWith(
      "/trusted tools/dab",
      args,
      expect.objectContaining({ cwd: "/project with spaces", stdio: "inherit", env: expect.objectContaining({ SWA_CLI_INTERNAL_COMMAND: "1" }) }),
    );
    expect(childProcess.execSync).not.toHaveBeenCalled();
  });

  it("preserves intentional customer shell commands rather than treating them as internal tools", () => {
    const command = "npm run build && npm run preview";
    runCommand(command, "/customer project");
    expect(childProcess.execSync).toHaveBeenCalledWith(
      command,
      expect.objectContaining({ cwd: "/customer project", env: expect.objectContaining({ SWA_CLI_INTERNAL_COMMAND: "1" }) }),
    );
  });
});
