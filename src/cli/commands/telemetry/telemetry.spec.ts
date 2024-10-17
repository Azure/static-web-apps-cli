import "../../../../tests/_mocks/fs.js";
import { logger } from "../../../core/utils/logger.js";
import { telemetry } from "./telemetry.js";
import { vol } from "memfs";

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

describe("swa telemetry", () => {
  afterEach(() => {
    vol.reset();
  });

  it("Telemetry should be enabled by default", async () => {
    await telemetry({ status: true });
    expect(logger.log).toHaveBeenNthCalledWith(1, "Telemetry capturing is enabled.");
  });

  it("should log the telemetry setting as enabled", async () => {
    await telemetry({ status: true });
    expect(logger.log).toHaveBeenNthCalledWith(1, "Telemetry capturing is enabled.");
  });

  it("should warn when both --enable and --disable flags are used", async () => {
    await telemetry({ disable: true, enable: true });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "Using the flags --disable and --enable together is not supported!");
  });

  it("should warn when both --enable and --status flags are used", async () => {
    await telemetry({ enable: true, status: true });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "The flag --status can't be used alongside the flags --disable and --enable!");
  });

  it("should warn when both --disable and --status flags are used", async () => {
    await telemetry({ disable: true, status: true });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "The flag --status can't be used alongside the flags --disable and --enable!");
  });

  it("should warn when all 3 --disable, --enable and --status flags are used", async () => {
    await telemetry({ enable: true, disable: true, status: true });
    expect(logger.warn).toHaveBeenNthCalledWith(1, "The flag --status can't be used alongside the flags --disable and --enable!");
  });
});
