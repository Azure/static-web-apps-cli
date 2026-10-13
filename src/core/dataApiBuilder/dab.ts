import {
  DATA_API_BUILDER_BINARY_NAME,
  DATA_API_BUILDER_COMMAND,
  DATA_API_BUILDER_FOLDER,
  DATA_API_BUILDER_LATEST_TAG,
  DATA_API_BUILDER_RELEASE_METADATA_URL,
  DEFAULT_DATA_API_BUILDER_BINARY,
} from "../constants.js";
import { fetchWithProxy as fetch } from "../../core/utils/fetch-proxy.js";
import fs from "node:fs";
import os from "node:os";
import AdmZip from "adm-zip";
import path from "node:path";
import { logger } from "../utils/logger.js";
import { getPlatform } from "../utils/platform.js";
import { downloadAndValidateBinary } from "../download-binary-helper.js";
import {
  ExecutableResolutionOptions,
  probeExecutable,
  resolveManagedExecutable,
  resolveTrustedExecutable,
  UnsupportedExecutableError,
} from "../utils/executable.js";

/**
 * Gets the filepath where the Microsoft.DataApiBuilder.exe is located
 *  - Gets the latest version from the manifest file
 *  - Checks if it is installed and is latest or not already
 *  - Gets the installed path if it is already present
 *  - Downloads, unzips and Installs if not already present
 * @params null
 *
 * @returns binaryPath
 */
export async function installAndGetDataApiBuilder(options: ExecutableResolutionOptions = {}): Promise<{ binaryPath: string }> {
  const platform = getPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform: ${os.platform()}`);
  }

  const releaseMetadata = (await getReleaseDataApiBuilderMetadata()).releaseMetadata;
  if (releaseMetadata === undefined) {
    throw new Error(`Could not load ${DATA_API_BUILDER_BINARY_NAME} metadata from remote. Please check your internet connection.`); // should we throw error and stop or can we allow users to use local version
  }
  const installed = await getInstalledDataApiBuilder(options);
  if (installed?.version === releaseMetadata.versionId) {
    return { binaryPath: installed.binaryPath };
  }

  return { binaryPath: await downloadAndUnzipBinary(releaseMetadata, platform, options) };
}

/**
 *
 * @param releaseMetadata Release metadata obtained from DATA_API_BUILDER_RELEASE_METADATA_URL
 * @param platform Current OS
 * @returns Binary Path after downloading and extracting
 */
async function downloadAndUnzipBinary(
  releaseMetadata: DataApiBuilderReleaseMetadata,
  platform: "win-x64" | "osx-x64" | "linux-x64",
  options: ExecutableResolutionOptions,
) {
  try {
    const destDirectory = path.resolve(DATA_API_BUILDER_FOLDER, releaseMetadata.versionId);
    const binaryPath = resolveManagedExecutable(path.join(destDirectory, getDefaultDataApiBuilderBinaryForOS(platform)), options);

    if (!fs.existsSync(binaryPath)) {
      logger.silly(`Downloading the version ${releaseMetadata.versionId}`);
      const zipFilePath = await downloadAndValidateBinary(
        releaseMetadata,
        DATA_API_BUILDER_BINARY_NAME,
        DATA_API_BUILDER_FOLDER,
        releaseMetadata?.versionId,
        platform,
      );

      extractBinary(zipFilePath, destDirectory);
    }

    if (platform == "linux-x64" || platform == "osx-x64") {
      logger.silly(`Setting executable permissions for data-api-builder binary`);
      fs.chmodSync(binaryPath, 0o755);
    }

    return resolveManagedExecutable(binaryPath, options);
  } catch (ex) {
    logger.error(`Unable to download/extract ${DATA_API_BUILDER_BINARY_NAME} binary.`);
    throw new Error(`Unable to install ${DATA_API_BUILDER_BINARY_NAME}. Check your network connection and retry. ${(ex as Error).message}`);
  }
}

/**
 * Fetches the latest version, metadata of Microsoft.DataApiBuilder.exe from DATA_API_BUILDER_RELEASE_METADATA_URL
 * @returns DataApiBuilderReleaseMetadata
 */
async function getReleaseDataApiBuilderMetadata(): Promise<{ releaseMetadata: DataApiBuilderReleaseMetadata | undefined }> {
  const response = await fetch(DATA_API_BUILDER_RELEASE_METADATA_URL);
  const responseMetadata = (await response.json()) as DataApiBuilderReleaseMetadata;

  if (Array.isArray(responseMetadata)) {
    const releaseMetadata = responseMetadata.find((c) => c.version === DATA_API_BUILDER_LATEST_TAG); // If we want to proceed with downloading the latest tag
    // const releaseMetadata = responseMetadata.find((c) => c.versionId === DATA_API_BUILDER_VERSION_ID); // If we want to pin a specific version

    return {
      releaseMetadata: releaseMetadata,
    };
  } else {
    return {
      releaseMetadata: undefined,
    };
  }
}

/**
 * Unzips the given file to destDirectory
 * @param zipFilePath file to unzip
 * @param destDirectory directory to extract
 */
function extractBinary(zipFilePath: string, destDirectory: string) {
  var zip = new AdmZip(zipFilePath);
  zip.extractAllTo(destDirectory, true);

  fs.unlinkSync(zipFilePath); // delete zip file after extraction
}

/**
 * the Data-api-builder binary for given OS
 * @param platform current OS
 * @returns the Data-api-builder binary for given OS
 */
// exported for testing
export function getDefaultDataApiBuilderBinaryForOS(platform: string): string {
  switch (platform) {
    case "win-x64":
      return DEFAULT_DATA_API_BUILDER_BINARY.Windows;
    case "osx-x64":
      return DEFAULT_DATA_API_BUILDER_BINARY.MacOs;
    case "linux-x64":
      return DEFAULT_DATA_API_BUILDER_BINARY.Linux;
    default:
      return DEFAULT_DATA_API_BUILDER_BINARY.Windows;
  }
}

/**
 * Returns installed version if installed else undefined
 * @param options Additional project-controlled roots to exclude from discovery
 * @returns installed version
 */
async function getInstalledDataApiBuilder(options: ExecutableResolutionOptions): Promise<{ binaryPath: string; version: string } | undefined> {
  logger.silly(`Running ${DATA_API_BUILDER_COMMAND} --version`);

  let binaryPath: string | undefined;
  try {
    binaryPath = resolveTrustedExecutable(DATA_API_BUILDER_COMMAND, options);
  } catch (error) {
    if (!(error instanceof UnsupportedExecutableError)) throw error;
    logger.warn(`${error.message} Using the CLI-managed Data API Builder download instead.`);
    return undefined;
  }
  if (!binaryPath) return undefined;
  try {
    const { stdout } = await probeExecutable(binaryPath, ["--version"]);
    const version = /^Microsoft\.DataApiBuilder\s+(\S+)/.exec(stdout.trim())?.[1];
    return version ? { binaryPath, version } : undefined;
  } catch (error) {
    logger.silly(`Unable to probe installed Data API Builder: ${(error as Error).message}`);
    return undefined;
  }
}
