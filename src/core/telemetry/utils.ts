import dotenv from "dotenv";
dotenv.config();

import TelemetryReporter from "./telemetryReporter";
import type { TelemetryEventMeasurements, TelemetryEventProperties } from "./telemetryReporterTypes";

export function collectTelemetryEvent(event: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter: TelemetryReporter = new TelemetryReporter(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);
  reporter.sendTelemetryEvent(event, properties, measurements);
}

export function collectTelemetryException(exception: Error, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter: TelemetryReporter = new TelemetryReporter(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);
  reporter.sendTelemetryException(exception, properties, measurements);
}
