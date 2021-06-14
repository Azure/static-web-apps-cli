import program from "commander";
import { UpdateNotifier } from "update-notifier";
import { run } from "./index";
const pkg = require("../../package.json");

const originalConsoleError = console.error;

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
    const notifier = UpdateNotifier as any;
    notifier.prototype.check = function () {
      this.shouldNotifyInNpmScript = true;
      this.update = {
        current: "0.1.0",
        latest: "1.0.0",
        name: pkg.name,
      };
    };
    const orginalNotify = notifier.prototype.notify;
    notifier.prototype.notify = function (options: any = {}) {
      options.defer = false;
      orginalNotify.bind(this)(options);
    };

    await expect(run(["node", "swa", "-v"])).rejects.toThrow(pkg.version);
    expect((console.error as jest.Mock).mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "[33m[39m
      [33m   ╭────────────────────────────────────────────────────╮[39m
         [33m│[39m                                                    [33m│[39m
         [33m│[39m          Update available [2m0.1.0[22m[0m → [0m[32m1.0.0[39m            [33m│[39m
         [33m│[39m   Run [36mnpm i @azure/static-web-apps-cli[39m to update   [33m│[39m
         [33m│[39m                                                    [33m│[39m
      [33m   ╰────────────────────────────────────────────────────╯[39m
      [33m[39m",
      ]
    `);
  });
});
