import "../../../../tests/_mocks/fs.js";
import child_process, { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import { logger } from "../../../core/utils/logger.js";
import { vol } from "memfs";
import * as accountModule from "../../../core/account.js";
import * as deployClientModule from "../../../core/deploy-client.js";
import { deploy } from "./deploy.js";
import * as loginModule from "../login/login.js";
import { loadPackageJson } from "../../../core/utils/json.js";
import { DEFAULT_VERSION, SUPPORTED_VERSIONS } from "../../../core/constants.js";
import * as optionsModule from "../../../core/utils/options.js";

const pkg = loadPackageJson();

// Prevent transitive jsonwebtoken/buffer-equal-constant-time loading error
// by fully mocking modules that pull in Azure SDK → jsonwebtoken chain
vi.mock("../../../core/account.js", () => ({
  chooseOrCreateProjectDetails: vi.fn(() => Promise.resolve({ resourceGroup: "mock-rg", staticSiteName: "mock-site" })),
  getStaticSiteDeployment: vi.fn(() => Promise.resolve({})),
  authenticateWithAzureIdentity: vi.fn(),
  listSubscriptions: vi.fn(),
  listTenants: vi.fn(),
}));

vi.mock("../login/login.js", () => ({
  login: vi.fn(() =>
    Promise.resolve({
      credentialChain: {},
      subscriptionId: "mock-subscription-id",
    }),
  ),
  loginCommand: vi.fn(),
}));

vi.mock("../../../core/utils/logger", () => {
  return {
    logger: {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      silly: vi.fn(),
    },
    logGitHubIssueMessageAndExit: vi.fn(),
  };
});

vi.mock("node:child_process", async (importOriginal) => {
  const actual: typeof child_process = await importOriginal();
  return {
    ...actual,
    default: { ...actual, spawn: vi.fn() },
    spawn: vi.fn(),
  };
});

vi.spyOn(deployClientModule, "getDeployClientPath").mockImplementation(() => {
  return Promise.resolve({
    binary: "mock-binary",
    buildId: "0.0.0",
  });
});
vi.spyOn(deployClientModule, "cleanUp").mockImplementation(() => {});

describe("deploy", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vol.reset();
    vi.resetModules();
    process.env = {};
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("should be a function", () => {
    expect(typeof deploy).toBe("function");
  });

  it("should return a Promise", () => {
    expect(deploy({ outputLocation: "./dist" })).toBeInstanceOf(Promise);
  });

  it("should print warning when using dry run mode", async () => {
    await deploy({
      outputLocation: "./dist",
      dryRun: true,
    });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "***********************************************************************");
    expect(logger.warn).toHaveBeenNthCalledWith(2, "* WARNING: Running in dry run mode. This project will not be deployed *");
    expect(logger.warn).toHaveBeenNthCalledWith(3, "***********************************************************************");
  });

  it.skip("should print error and exit when --api-location does not exist", async () => {
    await deploy({
      outputLocation: "./dist",
      apiLocation: "/does/not/exist",
    });
    expect(logger.error).toHaveBeenNthCalledWith(1, `The provided API folder /does/not/exist does not exist. Abort.`, true);
  });

  it.skip("should print an error and exit, if --deployment-token is not provided and login failed", async () => {
    vi.spyOn(loginModule, "login").mockImplementation(() => Promise.reject("mock-error"));

    await deploy({
      outputLocation: "./dist",
      apiLocation: "./api",
      dryRun: false,
    });
    expect(loginModule.login).toHaveBeenCalled();

    // getStaticSiteDeployment should not be called because login failed
    expect(accountModule.getStaticSiteDeployment).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenNthCalledWith(1, "A deployment token is required to deploy to Azure Static Web Apps");
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      "Provide a deployment token using the --deployment-token option or SWA_CLI_DEPLOYMENT_TOKEN environment variable",
      true,
    );

    expect(deployClientModule.getDeployClientPath).not.toBeCalled();
    expect(child_process.spawn).not.toBeCalled();
  });

  it.skip("should accept a deploymentToken provided via --deployment-token", async () => {
    await deploy({
      outputLocation: "./dist",
      apiLocation: "./api",
      deploymentToken: "123",
      dryRun: false,
    });

    expect(await deployClientModule.getDeployClientPath()).toEqual({
      binary: "mock-binary",
      version: "0.0.0",
    });

    expect(child_process.spawn).toBeCalledWith("mock-binary", [], {
      env: {
        DEPLOYMENT_ACTION: "upload",
        DEPLOYMENT_PROVIDER: "SwaCli",
        REPOSITORY_BASE: "./",
        SKIP_APP_BUILD: "true",
        SKIP_API_BUILD: "true",
        DEPLOYMENT_TOKEN: "123",
        APP_LOCATION: "./",
        OUTPUT_LOCATION: "./dist",
        API_LOCATION: "./api",
        VERBOSE: "false",
        SWA_CLI_DEBUG: undefined,
        SWA_CLI_DEPLOY_DRY_RUN: "false",
        SWA_RUNTIME_CONFIG_LOCATION: undefined,
        SWA_CLI_VERSION: `${pkg.version}`,
        SWA_RUNTIME_WORKFLOW_LOCATION: undefined,
        SWA_CLI_DEPLOY_BINARY: "mock-binary@0.0.0",
      },
    });
  });

  it.skip("should accept a deploymentToken provided via the environment variable SWA_CLI_DEPLOYMENT_TOKEN", async () => {
    process.env.SWA_CLI_DEPLOYMENT_TOKEN = "123";

    await deploy({
      outputLocation: "./dist",
      apiLocation: "./api",
      dryRun: false,
    });

    expect(await deployClientModule.getDeployClientPath()).toEqual({
      binary: "mock-binary",
      version: "0.0.0",
    });

    expect(child_process.spawn).toBeCalledWith("mock-binary", [], {
      env: {
        DEPLOYMENT_ACTION: "upload",
        DEPLOYMENT_PROVIDER: "SwaCli",
        REPOSITORY_BASE: "./",
        SKIP_APP_BUILD: "true",
        SKIP_API_BUILD: "true",
        DEPLOYMENT_TOKEN: "123",
        APP_LOCATION: "./",
        OUTPUT_LOCATION: "./dist",
        API_LOCATION: "./api",
        VERBOSE: "false",
        SWA_CLI_DEPLOYMENT_TOKEN: "123",
        SWA_CLI_DEPLOY_BINARY: "mock-binary@0.0.0",
        SWA_CLI_DEBUG: undefined,
        SWA_CLI_DEPLOY_DRY_RUN: "false",
        SWA_RUNTIME_CONFIG_LOCATION: undefined,
        SWA_CLI_VERSION: `${pkg.version}`,
        SWA_RUNTIME_WORKFLOW_LOCATION: undefined,
      },
    });
  });

  describe("StaticSitesClient process handling", () => {
    let mockChild: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let exitSpy: any;

    beforeEach(() => {
      // Create mock child process with stdout/stderr EventEmitters
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      mockChild = Object.assign(new EventEmitter(), { stdout, stderr });

      // Set up spawn mock to return the mock child process
      vi.mocked(spawn).mockReturnValue(mockChild as any);
      vi.spyOn(deployClientModule, "getDeployClientPath").mockResolvedValue({
        binary: "mock-binary",
        buildId: "0.0.0",
      });
      vi.spyOn(deployClientModule, "cleanUp").mockImplementation(() => {});

      // Mock process.exit to prevent test runner from exiting
      exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as unknown as () => never);

      // Provide deployment token via env to skip login flow
      process.env.SWA_CLI_DEPLOYMENT_TOKEN = "test-token";

      // Create required filesystem structure in memfs
      const cwd = process.cwd();
      vol.fromJSON({
        [path.join("/test-output", "index.html")]: "hello",
        [path.join(cwd, "placeholder")]: "",
      });
    });

    it("should capture stderr and pass to logger.error", async () => {
      await deploy({ outputLocation: "/test-output", dryRun: false });

      mockChild.stderr.emit("data", Buffer.from("some error from binary"));

      expect(logger.error).toHaveBeenCalledWith("some error from binary");
    });

    it("should fail spinner and log error on non-zero exit code", async () => {
      await deploy({ outputLocation: "/test-output", dryRun: false });

      mockChild.emit("close", 1);

      expect(logger.error).toHaveBeenCalledWith("The deployment binary exited with code 1.");
    });

    it("should call process.exit(1) on non-zero exit code", async () => {
      await deploy({ outputLocation: "/test-output", dryRun: false });

      mockChild.emit("close", 127);

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should succeed without calling process.exit on exit code 0", async () => {
      await deploy({ outputLocation: "/test-output", dryRun: false });

      mockChild.emit("close", 0);

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should not call process.exit(1) on non-zero exit code in dry-run mode", async () => {
      await deploy({ outputLocation: "/test-output", dryRun: true });

      mockChild.emit("close", 1);

      expect(logger.error).toHaveBeenCalledWith("The deployment binary exited with code 1.");
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should pass correct FUNCTION_LANGUAGE_VERSION for python when only apiLanguage is specified", async () => {
      vi.spyOn(optionsModule, "isUserOrConfigOption").mockImplementation((option) => option === "apiLanguage");

      await deploy({ outputLocation: "/test-output", dryRun: false, apiLanguage: "python" });

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      const env = spawnCall[2]?.env as Record<string, string>;
      expect(env.FUNCTION_LANGUAGE).toBe("python");
      expect(env.FUNCTION_LANGUAGE_VERSION).toBe(DEFAULT_VERSION.Python);
      expect(SUPPORTED_VERSIONS.Python).toContain(env.FUNCTION_LANGUAGE_VERSION);
    });

    it("should pass correct FUNCTION_LANGUAGE_VERSION for dotnet when only apiLanguage is specified", async () => {
      vi.spyOn(optionsModule, "isUserOrConfigOption").mockImplementation((option) => option === "apiLanguage");

      await deploy({ outputLocation: "/test-output", dryRun: false, apiLanguage: "dotnet" });

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      const env = spawnCall[2]?.env as Record<string, string>;
      expect(env.FUNCTION_LANGUAGE).toBe("dotnet");
      expect(env.FUNCTION_LANGUAGE_VERSION).toBe(DEFAULT_VERSION.Dotnet);
      expect(SUPPORTED_VERSIONS.Dotnet).toContain(env.FUNCTION_LANGUAGE_VERSION);
    });

    it("should pass correct FUNCTION_LANGUAGE_VERSION for dotnetisolated when only apiLanguage is specified", async () => {
      vi.spyOn(optionsModule, "isUserOrConfigOption").mockImplementation((option) => option === "apiLanguage");

      await deploy({ outputLocation: "/test-output", dryRun: false, apiLanguage: "dotnetisolated" });

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      const env = spawnCall[2]?.env as Record<string, string>;
      expect(env.FUNCTION_LANGUAGE).toBe("dotnetisolated");
      expect(env.FUNCTION_LANGUAGE_VERSION).toBe(DEFAULT_VERSION.DotnetIsolated);
      expect(SUPPORTED_VERSIONS.DotnetIsolated).toContain(env.FUNCTION_LANGUAGE_VERSION);
    });

    it("should print an error when --env is an empty string", async () => {
      await deploy({
        outputLocation: "/test-output",
        env: "",
      });
      expect(logger.error).toHaveBeenNthCalledWith(1, "Invalid --env: cannot be empty. Use 'preview' or omit the flag.");
    });
  });
});
