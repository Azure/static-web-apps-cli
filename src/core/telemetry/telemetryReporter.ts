import os from "node:os";
import { SenderData, BaseTelemetryReporter } from "./baseTelemetryReporter.js";
import { BaseTelemetrySender, BaseTelemetryClient } from "./baseTelemetrySender.js";
import { getSessionId } from "./utils.js";
import { getMachineId } from "../swa-cli-persistence-plugin/impl/machine-identifier.js";
import { RawTelemetryEventProperties } from "./telemetryReporterTypes.js";
import { logger } from "../utils/logger.js";
import applicationInsights from "applicationinsights";
import { TELEMETRY_EVENT_NAME } from "../constants.js";

/**
 * A factory function which creates a telemetry client to be used by an sender to send telemetry in a node application.
 *
 * @param key The app insights key
 *
 * @returns A promise which resolves to the telemetry client or rejects upon error
 */
let telemetryClientInstance: applicationInsights.TelemetryClient | null = null;
const appInsightsClientFactory = async (key: string): Promise<BaseTelemetryClient> => {
  const sessionId = await getSessionId(new Date().getTime());
  const macAddressHash = (await getMachineId()).toString();
  const extendedTelemetryEventProperties: RawTelemetryEventProperties = {
    SessionId: sessionId,
    MacAddressHash: macAddressHash,
    OsType: os.type(),
    OsVersion: os.version(),
    PreciseTimeStamp: new Date().getTime(),
  };

  if (!telemetryClientInstance) {
    try {
      applicationInsights
        .setup(key)
        .setAutoCollectDependencies(false)
        .setAutoCollectRequests(false)
        .setAutoCollectExceptions(false)
        .setAutoCollectPreAggregatedMetrics(false)
        .setSendLiveMetrics(false)
        .start();
      telemetryClientInstance = applicationInsights.defaultClient;
    } catch (e: any) {
      logger.silly(`ERROR IN INITIALIZING APP INSIGHTS: ${e}`);
      return Promise.reject("Failed to initialize app insights!\n" + e.message);
    }
  }

  const telemetryClient: BaseTelemetryClient = {
    logEvent: (eventName: string, data?: SenderData) => {
      try {
        telemetryClientInstance!.trackEvent({
          name: TELEMETRY_EVENT_NAME,
          properties: { ...data?.properties, ...extendedTelemetryEventProperties, command: eventName },
        });
      } catch (e: any) {
        throw new Error("Failed to log event to app insights!\n" + e.message);
      }
    },
    logException: (exceptionName: Error, data?: SenderData) => {
      try {
        telemetryClientInstance!.trackException({
          exception: exceptionName,
          properties: { ...data?.properties, ...extendedTelemetryEventProperties },
        });
      } catch (e: any) {
        throw new Error("Failed to log exception to app insights!\n" + e.message);
      }
    },
  };

  return telemetryClient;
};

export default class TelemetryReporter extends BaseTelemetryReporter {
  constructor(key: string | undefined) {
    if (key) {
      let clientFactory = (key: string) => appInsightsClientFactory(key);
      const sender = new BaseTelemetrySender(key, clientFactory);
      super(sender);
    } else {
      throw new Error("Please provide aiKey of your AppInsights instance!\n");
    }
  }
}
