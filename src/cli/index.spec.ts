// Avoid FSREQCALLBACK error
jest.mock("./commands/start");

import { program } from "commander";
import { UpdateNotifier } from "update-notifier";
import { run } from "./index";
const pkg = require("../../package.json");

const originalConsoleError = console.error;
const removeColors = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");

describe("cli", () => {
  beforeEach(() => {
    // Throws CommanderError instead of exiting after showing version or error
    program.exitOverride();
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("should print version", async () => {
    expect(run(["node", "swa", "-v"])).rejects.toThrow(pkg.version);
  });

  it("should notify of newer version", async () => {
    // Forces an update notification, bypassing regular checks
    process.stdout.isTTY = true;
    jest.spyOn(UpdateNotifier.prototype, "check").mockImplementation(function (this: any) {
      this.shouldNotifyInNpmScript = true;
      this.update = {
        current: "0.1.0",
        latest: "1.0.0",
        name: pkg.name,
      };
    });
    const orginalNotify = UpdateNotifier.prototype.notify;
    jest.spyOn(UpdateNotifier.prototype, "notify").mockImplementation(function (this: any, options: any = {}) {
      options.defer = false;
      orginalNotify.bind(this as any)(options);
    });

    await expect(run(["node", "swa", "-v"])).rejects.toThrow(pkg.version);
    expect(removeColors((console.error as jest.Mock).mock.calls[0].join("\n"))).toMatchInlineSnapshot(`
      "
         ╭────────────────────────────────────────────────────╮
         │                                                    │
         │          Update available 0.1.0 → 1.0.0            │
         │   Run npm i @azure/static-web-apps-cli to update   │
         │                                                    │
         ╰────────────────────────────────────────────────────╯
      "
    `);
  });
});
