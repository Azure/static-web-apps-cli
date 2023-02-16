import dotenv from "dotenv";
dotenv.config();

import TelemetryReporter from "./telemetryReporter";
import type { TelemetryEventMeasurements, TelemetryEventProperties } from "./telemetryReporterTypes";

export function collectTelemetryEvent(event: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  if (process.env.SWA_DISABLE_TELEMETRY == "false") {
    const reporter: TelemetryReporter = new TelemetryReporter(aiKey);
    reporter.sendTelemetryEvent(event, properties, measurements);
  }
}

export function collectTelemetryException(exception: Error, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  if (process.env.SWA_DISABLE_TELEMETRY == "false") {
    const reporter: TelemetryReporter = new TelemetryReporter(aiKey);
    reporter.sendTelemetryException(exception, properties, measurements);
  }
}
