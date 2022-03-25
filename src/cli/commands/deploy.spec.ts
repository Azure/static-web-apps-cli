import child_process from "child_process";
import { logger } from "../../core";
import * as deployClientModule from "../../core/deploy-client";
import { deploy } from "./deploy";
import path from "path";
const pkg = require(path.join(__dirname, "..", "..", "..", "package.json"));

jest.spyOn(logger, "error").mockImplementation();
jest.spyOn(logger, "log").mockImplementation();
jest.spyOn(process, "exit").mockImplementation();
jest.spyOn(child_process, "spawn").mockImplementation();
jest.spyOn(deployClientModule, "getDeployClientPath").mockImplementation(() => {
  return Promise.resolve({
    binary: "mock-binary",
    version: "0.0.0",
  });
});
jest.spyOn(deployClientModule, "cleanUp").mockImplementation(() => {});

describe("deploy", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {};
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("should be a function", () => {
    expect(typeof deploy).toBe("function");
  });

  it("should return a Promise", () => {
    expect(deploy("./", {})).toBeInstanceOf(Promise);
  });

  it("should print an error and exit, if --deployment-token is not provided", async () => {
    await deploy("./", {
      outputLocation: "./dist",
      apiLocation: "./api",
    });
    expect(logger.error).toHaveBeenNthCalledWith(1, "A deployment token is required to deploy to Azure Static Web Apps");
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      "Provide a deployment token using the --deployment-token option or SWA_CLI_DEPLOYMENT_TOKEN environment variable",
      true
    );
    expect(logger.error).toHaveBeenNthCalledWith(3, "A deployment token is required to deploy to Azure Static Web Apps");
    expect(deployClientModule.getDeployClientPath).not.toBeCalled();
    expect(child_process.spawn).not.toBeCalled();
  });

  it("should accept a deploymentToken provided via --deployment-token", async () => {
    await deploy("./", {
      outputLocation: "./dist",
      apiLocation: "./api",
      deploymentToken: "123",
    });

    expect(logger.log).toBeCalledWith("Deployment token provide via flag", "swa");

    expect(await deployClientModule.getDeployClientPath()).toEqual({
      binary: "mock-binary",
      version: "0.0.0",
    });

    expect(child_process.spawn).toBeCalledWith("mock-binary", [], {
      env: {
        DEPLOYMENT_ACTION: "upload",
        DEPLOYMENT_PROVIDER: `swa-cli-${pkg.version}`,
        REPOSITORY_BASE: "./",
        SKIP_APP_BUILD: "true",
        SKIP_API_BUILD: "true",
        DEPLOYMENT_TOKEN: "123",
        APP_LOCATION: "./",
        OUTPUT_LOCATION: "./dist",
        API_LOCATION: "./api",
        VERBOSE: "false",
        SWA_CLI_DEBUG: undefined,
        SWA_CLI_DEPLOY_DRY_RUN: "undefined",
        SWA_CLI_ROUTES_LOCATION: undefined,
        SWA_CLI_VERSION: `${pkg.version}`,
        SWA_WORKFLOW_FILES: undefined,
        SWA_CLI_DEPLOY_BINARY: "mock-binary@0.0.0",
      },
    });
  });

  it("should accept a deploymentToken provided via the environment variable SWA_CLI_DEPLOYMENT_TOKEN", async () => {
    process.env.SWA_CLI_DEPLOYMENT_TOKEN = "123";

    await deploy("./", {
      outputLocation: "./dist",
      apiLocation: "./api",
    });

    expect(logger.log).toBeCalledWith("Deployment token found in Environment Variables:", "swa");

    expect(await deployClientModule.getDeployClientPath()).toEqual({
      binary: "mock-binary",
      version: "0.0.0",
    });

    expect(child_process.spawn).toBeCalledWith("mock-binary", [], {
      env: {
        DEPLOYMENT_ACTION: "upload",
        DEPLOYMENT_PROVIDER: `swa-cli-${pkg.version}`,
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
        SWA_CLI_DEPLOY_DRY_RUN: "undefined",
        SWA_CLI_ROUTES_LOCATION: undefined,
        SWA_CLI_VERSION: `${pkg.version}`,
        SWA_WORKFLOW_FILES: undefined,
      },
    });
  });
});
