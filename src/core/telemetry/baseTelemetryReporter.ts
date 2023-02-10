import type { TelemetryEventMeasurements, RawTelemetryEventProperties, TelemetryEventProperties } from "./telemetryReporterTypes";
import { BaseTelemetrySender } from "./baseTelemetrySender";

export interface SenderData {
  properties?: RawTelemetryEventProperties;
  measurements?: TelemetryEventMeasurements;
}

export class BaseTelemetryReporter {
  constructor(private telemetrySender: BaseTelemetrySender) {
    this.telemetrySender.instantiateSender();
  }
  /**
   * Internal function which logs telemetry events and takes extra options.
   * @param eventName The name of the event
   * @param properties The properties of the event
   * @param measurements The measurements (numeric values) to send with the event
   */
  private internalSendTelemetryEvent(
    eventName: string,
    properties: TelemetryEventProperties | undefined,
    measurements: TelemetryEventMeasurements | undefined
  ): void {
    this.telemetrySender.sendEventData(eventName, { properties, measurements });
  }

  /**
   * Given an event name, some properties, and measurements sends a telemetry event.
   * Properties are sanitized on best-effort basis to remove sensitive data prior to sending.
   * @param eventName The name of the event
   * @param properties The properties to send with the event
   * @param measurements The measurements (numeric values) to send with the event
   */
  public sendTelemetryEvent(eventName: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void {
    this.internalSendTelemetryEvent(eventName, properties, measurements);
  }

  /**
   * Given an event name, some properties, and measurements sends an error event
   * @param eventName The name of the event
   * @param properties The properties to send with the event
   * @param measurements The measurements (numeric values) to send with the event
   */
  public sendTelemetryErrorEvent(eventName: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void {
    this.internalSendTelemetryEvent(eventName, properties, measurements);
  }

  /**
   * Internal function which logs telemetry exceptions and takes extra options
   * @param error: The error to send
   * @param properties The properties of the event
   * @param measurements The measurements (numeric values) to send with the event
   */
  private internalSendTelemetryException(
    error: Error,
    properties: TelemetryEventProperties | undefined,
    measurements: TelemetryEventMeasurements | undefined
  ): void {
    this.telemetrySender.sendErrorData(error, { properties, measurements });
  }

  /**
   * Given an error, properties, and measurements. Sends an exception event
   * @param error The error to send
   * @param properties The properties to send with the event
   * @param measurements The measurements (numeric values) to send with the event
   */
  public sendTelemetryException(error: Error, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void {
    this.internalSendTelemetryException(error, properties, measurements);
  }
}
