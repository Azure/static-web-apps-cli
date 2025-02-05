import dotenv from "dotenv";
dotenv.config();

import TelemetryReporter from "./telemetryReporter.js";
import type { TelemetryEventMeasurements, TelemetryEventProperties } from "./telemetryReporterTypes.js";
import { readCLIEnvFile } from "../utils/file.js";
import { getEnvVariablesForTelemetry } from "../../config.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";
import { CryptoService } from "../swa-cli-persistence-plugin/impl/crypto.js";
import { TELEMETRY_AI_KEY, TELEMETRY_SERVICE_HASH } from "../constants.js";
import { getNodeMajorVersion } from "../func-core-tools.js";

export async function collectTelemetryEvent(event: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter = await GetTelemetryReporter();

  if (reporter) {
    let environmentVariables = getEnvVariablesForTelemetry();

    let extendedTelemetryEventProperties = {
      SubscriptionId: environmentVariables.AZURE_SUBSCRIPTION_ID!,
      SwaCliVersion: environmentVariables.SWA_CLI_VERSION!,
      CliRuntimeEnvironment: "node" + getNodeMajorVersion(),
      FunctionsUsage: environmentVariables.SWA_CLI_API_LOCATION ? "true" : "false",
      DataApiUsage: environmentVariables.SWA_CLI_DATA_API_LOCATION ? "true" : "false",
    } as TelemetryEventProperties;

    logger.silly(`TELEMETRY REPORTING: ${event}, ${JSON.stringify({ ...properties, ...extendedTelemetryEventProperties })}, ${measurements}`);
    reporter.sendTelemetryEvent(event, { ...properties, ...extendedTelemetryEventProperties }, measurements);
  }
}

export async function collectTelemetryException(exception: Error, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements) {
  const reporter = await GetTelemetryReporter();
  if (reporter) {
    let environmentVariables = getEnvVariablesForTelemetry();

    let extendedTelemetryEventProperties = {
      subscriptionId: environmentVariables.AZURE_SUBSCRIPTION_ID!,
      swaCliVersion: environmentVariables.SWA_CLI_VERSION!,
    } as TelemetryEventProperties;

    logger.silly(
      `TELEMETRY REPORTING EXCEPTION: ${exception}, ${JSON.stringify({ ...properties, ...extendedTelemetryEventProperties })}, ${measurements}`,
    );
    reporter.sendTelemetryException(exception, { ...properties, ...extendedTelemetryEventProperties }, measurements);
  }
}

export async function GetTelemetryReporter() {
  const config = await readCLIEnvFile();
  if (!config["SWA_CLI_CAPTURE_TELEMETRY"] || config["SWA_CLI_CAPTURE_TELEMETRY"].toLowerCase() === "true") {
    const cryptoService = new CryptoService(TELEMETRY_SERVICE_HASH);
    const decryptedAiKey = await cryptoService.decrypt(TELEMETRY_AI_KEY);
    const reporter: TelemetryReporter = new TelemetryReporter(decryptedAiKey);
    return reporter;
  }
  return undefined;
}

export async function getSessionId(timeStamp: number): Promise<string> {
  const timeStampStr = timeStamp.toString();
  const PID = process.pid.toString();
  return crypto
    .createHash("sha256")
    .update(PID + timeStampStr)
    .digest("hex");
}
