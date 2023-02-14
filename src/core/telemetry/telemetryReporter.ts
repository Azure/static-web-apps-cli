import type { TelemetryClient } from "applicationinsights";
import { SenderData, BaseTelemetryReporter } from "./baseTelemetryReporter";
import { BaseTelemetrySender, BaseTelemetryClient } from "./baseTelemetrySender";
/**
 * A factory function which creates a telemetry client to be used by an sender to send telemetry in a node application.
 *
 * @param key The app insights key
 *
 * @returns A promise which resolves to the telemetry client or rejects upon error
 */
const appInsightsClientFactory = async (key: string): Promise<BaseTelemetryClient> => {
  let appInsightsClient: TelemetryClient | undefined;
  try {
    const appInsights = await import("applicationinsights");
    //check if another instance is already initialized
    if (appInsights.defaultClient) {
      appInsightsClient = new appInsights.TelemetryClient(key);
      appInsightsClient.channel.setUseDiskRetryCaching(true);
    } else {
      appInsights
        .setup(key)
        .setAutoCollectRequests(false)
        .setAutoCollectPerformance(false)
        .setAutoCollectExceptions(false)
        .setAutoCollectDependencies(false)
        .setAutoDependencyCorrelation(false)
        .setAutoCollectConsole(true, true)
        .setAutoCollectHeartbeat(false)
        .setUseDiskRetryCaching(true)
        .start();
      appInsightsClient = appInsights.defaultClient;
    }
  } catch (e: any) {
    return Promise.reject("Failed to initialize app insights!\n" + e.message);
  }

  const telemetryClient: BaseTelemetryClient = {
    logEvent: (eventName: string, data?: SenderData) => {
      try {
        appInsightsClient?.trackEvent({
          name: eventName,
          properties: data?.properties,
          measurements: data?.measurements,
        });
      } catch (e: any) {
        throw new Error("Failed to log event to app insights!\n" + e.message);
      }
    },
    logException: (exceptionName: Error, data?: SenderData) => {
      try {
        appInsightsClient?.trackException({
          exception: exceptionName,
          properties: data?.properties,
          measurements: data?.measurements,
        });
      } catch (e: any) {
        throw new Error("Failed to log exception to app insights!\n" + e.message);
      }
    },
    flush: async () => {
      try {
        appInsightsClient?.flush();
      } catch (e: any) {
        throw new Error("Failed to flush app insights!\n" + e.message);
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
