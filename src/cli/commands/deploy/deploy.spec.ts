import "../../../../tests/_mocks/fs.js";
import child_process from "node:child_process";
import { logger } from "../../../core/utils/logger.js";
import { vol } from "memfs";
import * as accountModule from "../../../core/account.js";
import * as deployClientModule from "../../../core/deploy-client.js";
import { deploy } from "./deploy.js";
import * as loginModule from "../login/login.js";
import pkg from "../../../../package.json" with { type: "json" };

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

//vi.spyOn(process, "exit").mockImplementation(() => {});
vi.spyOn(child_process, "spawn").mockImplementation(vi.fn());
vi.spyOn(deployClientModule, "getDeployClientPath").mockImplementation(() => {
  return Promise.resolve({
    binary: "mock-binary",
    buildId: "0.0.0",
  });
});
vi.spyOn(deployClientModule, "cleanUp").mockImplementation(() => {});

vi.spyOn(accountModule, "getStaticSiteDeployment").mockImplementation(() => Promise.resolve({}));

vi.spyOn(loginModule, "login").mockImplementation(() => {
  return Promise.resolve({
    credentialChain: {} as any,
    subscriptionId: "mock-subscription-id",
    resourceGroup: "mock-resource-group-name",
    staticSiteName: "mock-static-site-name",
  });
});

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
});
