export interface TelemetryEventProperties {
  readonly [key: string]: string;
}

export interface RawTelemetryEventProperties {
  readonly [key: string]: any;
}

export interface TelemetryEventMeasurements {
  readonly [key: string]: number;
}

export default class TelemetryReporter {
  /**
   * @param key The app insights key
   */
  constructor(key: string);

  /**
   * Sends a telemetry event with the given properties and measurements
   * Properties are sanitized on best-effort basis to remove sensitive data prior to sending.
   * @param eventName The name of the event
   * @param properties The set of properties to add to the event in the form of a string key value pair
   * @param measurements The set of measurements to add to the event in the form of a string key  number value pair
   */
  sendTelemetryEvent(eventName: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void;

  /**
   * Sends a telemetry error event with the given properties, measurements.
   * **Note**: The errorProps parameter has been removed since v0.6, if you would like to remove a property please use the replacementOptions parameter in the constructor.
   * @param eventName The name of the event
   * @param properties The set of properties to add to the event in the form of a string key value pair
   * @param measurements The set of measurements to add to the event in the form of a string key  number value pair
   */
  sendTelemetryErrorEvent(eventName: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void;

  /**
   * Sends an exception which includes the error stack, properties, and measurements
   * @param error The error to send
   * @param properties The set of properties to add to the event in the form of a string key value pair
   * @param measurements The set of measurements to add to the event in the form of a string key  number value pair
   */
  sendTelemetryException(exception: Error, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void;

  /**
   * Disposes of the telemetry reporter. This flushes the remaining events and disposes of the telemetry client.
   */
  dispose(): Promise<any>;
}
