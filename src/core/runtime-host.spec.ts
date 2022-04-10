import path from "path";
import { createRuntimeHost } from "./runtime-host";
import * as detectRuntime from "./runtimes";

jest.mock("../config", () => {
  return {
    DEFAULT_CONFIG: {
      outputLocation: "/foobar",
    },
  };
});

const SEP = `.${path.sep}`;
let spyDetectRuntime: jest.SpyInstance;
let mockRuntimeHostConfig: RuntimeHostConfig;

describe("runtimeHost", () => {
  beforeEach(() => {
    process.env.SWA_CLI_DEBUG = "";
    spyDetectRuntime = jest.spyOn(detectRuntime, "detectRuntime");
    spyDetectRuntime.mockReturnValue(detectRuntime.RuntimeType.unknown);
    jest.mock("./utils/logger", () => {});

    mockRuntimeHostConfig = {
      appPort: 8080,
      outputLocation: SEP,
      appLocation: SEP,
      proxyHost: "0.0.0.0",
      proxyPort: 4242,
    };
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe("createRuntimeHost()", () => {
    it("outputLocation should be propagated in resulting command", () => {
      mockRuntimeHostConfig.outputLocation = "./foobar";
      const rh = createRuntimeHost(mockRuntimeHostConfig);

      expect(spyDetectRuntime).toHaveBeenCalledWith(SEP);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual(["./foobar", "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });

    it("outputLocation should default to DEFAULT_CONFIG.outputLocation if undefined", () => {
      mockRuntimeHostConfig.outputLocation = undefined as any;
      const rh = createRuntimeHost(mockRuntimeHostConfig);

      expect(spyDetectRuntime).toHaveBeenCalledWith(SEP);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual(["/foobar", "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });

    it("proxyHost should be propagated in resulting command", () => {
      mockRuntimeHostConfig.proxyHost = "127.0.0.1";
      const rh = createRuntimeHost(mockRuntimeHostConfig);

      expect(spyDetectRuntime).toHaveBeenCalledWith(SEP);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual([SEP, "-d", "false", "--host", "127.0.0.1", "--port", "8080", "--cache", "-1"]);
    });

    it("proxyPort should be propagated in resulting command", () => {
      mockRuntimeHostConfig.proxyPort = 3000;
      const rh = createRuntimeHost(mockRuntimeHostConfig);

      expect(spyDetectRuntime).toHaveBeenCalledWith(SEP);
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual([SEP, "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });

    it("appLocation should be propagated to the runtime detector", () => {
      mockRuntimeHostConfig.appLocation = "/bar";
      const rh = createRuntimeHost(mockRuntimeHostConfig);

      expect(spyDetectRuntime).toHaveBeenCalledWith("/bar");
      expect(rh.command).toContain(`npx http-server`);
      expect(rh.args).toEqual([`.${path.sep}`, "-d", "false", "--host", "0.0.0.0", "--port", "8080", "--cache", "-1"]);
    });
  });
});
