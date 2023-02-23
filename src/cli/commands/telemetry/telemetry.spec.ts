import fs from "fs";
import mockFs from "mock-fs";
import os from "os";
import path from "path";
import { logger } from "../../../core";
import { ENV_FILENAME } from "../../../core/constants";
import { telemetry } from "./telemetry";

jest.mock("../../../core/utils/logger", () => {
  return {
    logger: {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      silly: jest.fn(),
    },
    logGiHubIssueMessageAndExit: jest.fn(),
  };
});

describe("swa telemetry", () => {
  afterEach(() => {
    mockFs.restore();
  });

  it("Telemetry should be enabled by default", async () => {
    mockFs();
    await telemetry({ status: true });
    expect(logger.log).toHaveBeenNthCalledWith(1, "Telemetry capturing is enabled.");
  });

  it("should store disable telemetry setting in .env file", async () => {
    await telemetry({ disable: true });
    const envFile = path.join(os.homedir(), ".swa", ENV_FILENAME);
    const envFileContent = fs.readFileSync(envFile, "utf-8");

    expect(envFileContent).toMatchSnapshot(`
        "SWA_DISABLE_TELEMETRY=true"
        `);
  });

  it("should log the telemetry setting as disabled", async () => {
    await telemetry({ status: true });
    expect(logger.log).toHaveBeenNthCalledWith(3, "Telemetry capturing is disabled.");
  });

  it("should store enable telemetry setting in .env file", async () => {
    await telemetry({ enable: true });
    const envFile = path.join(os.homedir(), ".swa", ENV_FILENAME);
    const envFileContent = fs.readFileSync(envFile, "utf-8");

    expect(envFileContent).toMatchSnapshot(`
        "SWA_DISABLE_TELEMETRY=false"
        `);
  });

  it("should log the telemetry setting as enabled", async () => {
    await telemetry({ status: true });
    expect(logger.log).toHaveBeenNthCalledWith(5, "Telemetry capturing is enabled.");
  });

  it("should disable telemetry when both --enable and --disable flags are used", async () => {
    await telemetry({ disable: true, enable: true });
    const envFile = path.join(os.homedir(), ".swa", ENV_FILENAME);
    const envFileContent = fs.readFileSync(envFile, "utf-8");

    expect(envFileContent).toMatchSnapshot(`
        "SWA_DISABLE_TELEMETRY=true"
        `);
  });

  it("should log the telemetry setting as disabled", async () => {
    await telemetry({ status: true });
    expect(logger.log).toHaveBeenNthCalledWith(7, "Telemetry capturing is disabled.");
  });

  it("should warn when both --enable and --status flags are used", async () => {
    mockFs();
    await telemetry({ enable: true, status: true });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "The flag --status can't be used alongside the flags --disable and --enable!");
  });

  it("should warn when both --disable and --status flags are used", async () => {
    mockFs();
    await telemetry({ disable: true, status: true });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "The flag --status can't be used alongside the flags --disable and --enable!");
  });

  it("should warn when all 3 --disable, --enable and --status flags are used", async () => {
    mockFs();
    await telemetry({ enable: true, disable: true, status: true });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "The flag --status can't be used alongside the flags --disable and --enable!");
  });
});
