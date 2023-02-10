import { SenderData } from "./baseTelemetryReporter";

export interface BaseTelemetryClient {
  logEvent(eventName: string, data?: SenderData): void;
  logException(exceptionName: Error, data?: SenderData): void;
  flush(): void | Promise<void>;
}

enum InstantiationStatus {
  NOT_INSTANTIATED,
  INSTANTIATING,
  INSTANTIATED,
}

export interface TelemetrySender {
  instantiateSender(): void;
}

export class BaseTelemetrySender implements TelemetrySender {
  // Whether or not the client has been instantiated
  private _instantiationStatus: InstantiationStatus = InstantiationStatus.NOT_INSTANTIATED;
  private _telemetryClient: BaseTelemetryClient | undefined;

  // Queues used to store events until the sender is ready
  private _eventQueue: Array<{ eventName: string; data: SenderData | undefined }> = [];
  private _exceptionQueue: Array<{ exception: Error; data: SenderData | undefined }> = [];

  // Necessary information to create a telemetry client
  private _clientFactory: (key: string) => Promise<BaseTelemetryClient>;
  private _key: string;

  constructor(key: string, clientFactory: (key: string) => Promise<BaseTelemetryClient>) {
    this._clientFactory = clientFactory;
    this._key = key;
  }

  /**
   * Sends the event to the passed in telemetry client
   * @param eventName The name of the event to log
   * @param data The data contained in the event
   */
  sendEventData(eventName: string, data?: SenderData): void {
    if (!this._telemetryClient) {
      if (this._instantiationStatus !== InstantiationStatus.INSTANTIATED) {
        this._eventQueue.push({ eventName, data });
      }
      return;
    }
    this._telemetryClient.logEvent(eventName, data);
  }

  /**
   * Sends an exception to the passed in telemetry client
   * @param exception The exception to collect
   * @param data Data associated with the exception
   */
  sendExceptionData(exception: Error, data?: SenderData): void {
    if (!this._telemetryClient) {
      if (this._instantiationStatus !== InstantiationStatus.INSTANTIATED) {
        this._exceptionQueue.push({ exception, data });
      }
      return;
    }
    this._telemetryClient.logException(exception, data);
  }

  /**
   * Flushes the buffered telemetry data
   */
  async flush(): Promise<void> {
    if (this._telemetryClient) {
      await this._telemetryClient.flush();
      this._telemetryClient = undefined;
    }
    return;
  }

  /**
   * Flushes the queued events that existed before the client was instantiated
   */
  private _flushQueues(): void {
    this._eventQueue.forEach(({ eventName, data }) => this.sendEventData(eventName, data));
    this._eventQueue = [];
    this._exceptionQueue.forEach(({ exception, data }) => this.sendExceptionData(exception, data));
    this._exceptionQueue = [];
  }

  /**
   * Instantiates the telemetry client to make the sender "active"
   */
  instantiateSender(): void {
    if (this._instantiationStatus !== InstantiationStatus.NOT_INSTANTIATED) {
      return;
    }
    this._instantiationStatus = InstantiationStatus.INSTANTIATING;
    // Call the client factory to get the client and then let it know it's instantiated
    this._clientFactory(this._key)
      .then((client) => {
        this._telemetryClient = client;
        this._instantiationStatus = InstantiationStatus.INSTANTIATED;
        this._flushQueues();
      })
      .catch((err) => {
        throw new Error("Failed to instantiate app insights client factory!\n" + err.message);
      });
  }
}
