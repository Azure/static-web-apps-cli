import dotenv from "dotenv";
dotenv.config();

import TelemetryReporter from "./telemetryReporter";
import type { TelemetryEventMeasurements, TelemetryEventProperties } from "./telemetryReporterTypes";
import { readCLIEnvFile } from "../utils";
import * as crypto from "crypto";
import { DEFAULT_CONFIG } from "../../config";
import { logger } from "../utils";

const aiKey = "8428a7f6-6650-4490-a15a-c7f7a16449d7";
let sessionId: Promise<string>;

export async function collectTelemetryEvent(event: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter = await getTelemetryReporter();

  if (reporter) {
    let extendedTelemetryEventProperties = {
      subscriptionId: DEFAULT_CONFIG.subscriptionId!,
    } as TelemetryEventProperties;

    reporter.sendTelemetryEvent(event, { ...properties, ...extendedTelemetryEventProperties }, measurements);
  }
}

export async function collectTelemetryException(exception: Error, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter = await getTelemetryReporter();
  if (reporter) {
    reporter.sendTelemetryException(exception, properties, measurements);
  }
}

export async function getTelemetryReporter() {
  const config = await readCLIEnvFile();
  if (!config["SWA_CLI_CAPTURE_TELEMETRY"] || config["SWA_CLI_CAPTURE_TELEMETRY"].toLowerCase() === "true") {
    const reporter: TelemetryReporter = new TelemetryReporter(aiKey);
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
