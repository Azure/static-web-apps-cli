import dotenv from "dotenv";
dotenv.config();

import TelemetryReporter from "./telemetryReporter.js";
import type { TelemetryEventMeasurements, TelemetryEventProperties } from "./telemetryReporterTypes.js";
import { readCLIEnvFile } from "../utils/file.js";
import { DEFAULT_CONFIG } from "../../config.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

let sessionId: Promise<string>;

export async function collectTelemetryEvent(event: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter = await GetTelemetryReporter();
  logger.silly(`REPORTER!: ${reporter}`);

  if (reporter) {
    let extendedTelemetryEventProperties = {
      subscriptionId: DEFAULT_CONFIG.subscriptionId!,
    } as TelemetryEventProperties;

    logger.silly(`TELEMETRY REPORTING: ${event}, ${{ ...properties, ...extendedTelemetryEventProperties }}, ${measurements}`);
    reporter.sendTelemetryEvent(event, { ...properties, ...extendedTelemetryEventProperties }, measurements);
  }
}

export async function collectTelemetryException(exception: Error, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter = await GetTelemetryReporter();
  if (reporter) {
    reporter.sendTelemetryException(exception, properties, measurements);
  }
}

export async function GetTelemetryReporter() {
  const config = await readCLIEnvFile();
  if (!config["SWA_CLI_CAPTURE_TELEMETRY"] || config["SWA_CLI_CAPTURE_TELEMETRY"].toLowerCase() === "true") {
    const reporter: TelemetryReporter = new TelemetryReporter();
    return reporter;
  }
  return undefined;
}

export async function getSessionId(timeStamp: number): Promise<string> {
  if (!sessionId) {
    const timeStampStr = timeStamp.toString();
    const PID = process.pid.toString();
    sessionId = (async () => {
      return (await getPIDHash(PID, timeStampStr)) || crypto.randomBytes(20).toString("hex");
    })();
  }
  return sessionId;
}

async function getPIDHash(PID: string, timeStampStr: string): Promise<string | undefined> {
  try {
    return crypto
      .createHash("sha256")
      .update(PID + timeStampStr)
      .digest("hex");
  } catch (err) {
    logger.error(err as any);
    return undefined;
  }
}
