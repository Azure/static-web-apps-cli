jest.mock("./utils/logger", () => {});
import path from "path";
import { createRuntimeHost } from "./runtime-host";
import * as detectRuntime from "./runtimes";

let spyDetectRuntime: jest.SpyInstance;
const mockConfig = {
  appPort: 8080,
  outputLocation: `.${path.sep}`,
  appLocation: `.${path.sep}`,
  proxyHost: "0.0.0.0",
  proxyPort: 4242,
};

describe("runtimeHost", () => {
  beforeEach(() => {
    process.env.SWA_CLI_DEBUG = "";
    spyDetectRuntime = jest.spyOn(detectRuntime, "detectRuntime");
    spyDetectRuntime.mockReturnValue(detectRuntime.RuntimeType.unknown);
  });

  describe("createRuntimeHost()", () => {
    it("outputLocation should be propagated in resulting command", () => {
      const rh = createRuntimeHost({
        ...mockConfig,
        outputLocation: "./foobar",
      });

      expect(spyDetectRuntime).toHaveBeenCalledWith(`.${path.sep}`);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual(["./foobar", "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });

    it("outputLocation should default to ./ if undefined", () => {
      const rh = createRuntimeHost({
        ...mockConfig,
        outputLocation: undefined,
      });

      expect(spyDetectRuntime).toHaveBeenCalledWith(`.${path.sep}`);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual([`.${path.sep}`, "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });

    it("proxyHost should be propagated in resulting command", () => {
      const rh = createRuntimeHost({
        ...mockConfig,
        proxyHost: "127.0.0.1",
      });

      expect(spyDetectRuntime).toHaveBeenCalledWith(`.${path.sep}`);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual([`.${path.sep}`, "-d", "false", "--host", "127.0.0.1", "--port", "8080", "--cache", "-1"]);
    });

    it("proxyPort should be propagated in resulting command", () => {
      const rh = createRuntimeHost({
        ...mockConfig,
        proxyPort: 3000,
      });

      expect(spyDetectRuntime).toHaveBeenCalledWith(`.${path.sep}`);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual([`.${path.sep}`, "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });

    it("appLocation should be propagated to the runtime detector", () => {
      const rh = createRuntimeHost({
        ...mockConfig,
        appLocation: "./foobar",
      });

      expect(spyDetectRuntime).toHaveBeenCalledWith("./foobar");
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual([`.${path.sep}`, "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });
  });
});
