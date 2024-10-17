import type { TelemetryClient } from "applicationinsights";
import os from "node:os";
import { SenderData, BaseTelemetryReporter } from "./baseTelemetryReporter.js";
import { BaseTelemetrySender, BaseTelemetryClient } from "./baseTelemetrySender.js";
import { getSessionId } from "./utils.js";
import { getMachineId } from "../swa-cli-persistence-plugin/impl/machine-identifier.js";
import { TelemetryEventProperties } from "./telemetryReporterTypes.js";
import { logger } from "../utils/logger.js";
import { useAzureMonitor, AzureMonitorOpenTelemetryOptions } from "@azure/monitor-opentelemetry";
import { SpanKind, trace } from "@opentelemetry/api";

/**
 * A factory function which creates a telemetry client to be used by an sender to send telemetry in a node application.
 *
 * @param key The app insights key
 *
 * @returns A promise which resolves to the telemetry client or rejects upon error
 */
const appInsightsClientFactory = async (key: string): Promise<BaseTelemetryClient> => {
  let appInsightsClient: TelemetryClient | undefined;
  const sessionId = await getSessionId(new Date().getTime());
  const macAddressHash = (await getMachineId()).toString();
  const extendedTelemetryEventProperties: TelemetryEventProperties = {
    sessionId: sessionId,
    macAddressHash: macAddressHash,
    OsType: os.type(),
    OsVersion: os.version(),
  };

  try {
    logger.silly(`APP INSIGHT KEY: ${key}`);
    logger.silly(extendedTelemetryEventProperties);
    const options: AzureMonitorOpenTelemetryOptions = {
      azureMonitorExporterOptions: {
        connectionString: key,
        disableOfflineStorage: true,
      },
    };

    useAzureMonitor(options);
  } catch (e: any) {
    logger.silly(`ERROR IN INITIALIZING APP INSIGHTS: ${e}`);
    return Promise.reject("Failed to initialize app insights!\n" + e.message);
  }

  const telemetryClient: BaseTelemetryClient = {
    logEvent: (eventName: string, data?: SenderData) => {
      try {
        logger.silly(eventName);
        logger.silly(data!);
        const tracer = trace.getTracer("testTracer");
        let span = tracer.startSpan("hello", {
          kind: SpanKind.SERVER,
        });
        span.end();
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
