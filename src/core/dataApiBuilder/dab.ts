import {
  DATA_API_BUILDER_BINARY_NAME,
  DATA_API_BUILDER_COMMAND,
  DATA_API_BUILDER_FOLDER,
  DATA_API_BUILDER_LATEST_TAG,
  DATA_API_BUILDER_RELEASE_METADATA_URL,
  DEFAULT_DATA_API_BUILDER_BINARY,
} from "../constants.js";
import { fetchWithProxy as fetch } from "../../core/utils/fetch-proxy.js";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import AdmZip from "adm-zip";
import path from "node:path";
import { logger } from "../utils/logger.js";
import { getPlatform } from "../utils/platform.js";
import { downloadAndValidateBinary } from "../download-binary-helper.js";

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
export async function installAndGetDataApiBuilder(): Promise<{ binaryPath: string }> {
  const platform = getPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform: ${os.platform()}`);
  }

  const releaseMetadata = (await getReleaseDataApiBuilderMetadata()).releaseMetadata;
  if (releaseMetadata === undefined) {
    throw new Error(`Could not load ${DATA_API_BUILDER_BINARY_NAME} metadata from remote. Please check your internet connection.`); // should we throw error and stop or can we allow users to use local version
  }
  const isLatestVersionInstalled = await isLocalVersionInstalledAndLatest(releaseMetadata.versionId);

  if (!isLatestVersionInstalled) {
    const binaryPath = await downloadAndUnzipBinary(releaseMetadata, platform);

    if (binaryPath != undefined) {
      return {
        binaryPath: binaryPath,
      };
    }
  }

  return {
    binaryPath: DATA_API_BUILDER_COMMAND,
  };
}

/**
 *
 * @param releaseMetadata Release metadata obtained from DATA_API_BUILDER_RELEASE_METADATA_URL
 * @param platform Current OS
 * @returns Binary Path after downloading and extracting
 */
async function downloadAndUnzipBinary(releaseMetadata: DataApiBuilderReleaseMetadata, platform: "win-x64" | "osx-x64" | "linux-x64") {
  try {
    const destDirectory = path.join(DATA_API_BUILDER_FOLDER, releaseMetadata.versionId);
    const binaryPath = path.join(destDirectory, getDefaultDataApiBuilderBinaryForOS(platform));

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

    return binaryPath;
  } catch (ex) {
    logger.error(`Unable to download/extract ${DATA_API_BUILDER_BINARY_NAME} binary. Exception ${ex}`);
    return undefined;
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
 * Returns if the version installed locally is latest or not
 * @param releaseVersion current released Version of the Microsoft.DataApiBuilder.exe
 * @param platform current OS
 * @returns true if latest Version of data-api-builder is installed else false
 */
async function isLocalVersionInstalledAndLatest(releaseVersion: string): Promise<boolean | undefined> {
  const versionInstalled = await getInstalledVersion(DATA_API_BUILDER_COMMAND);

  if (versionInstalled) {
    logger.silly(`Installed version: ${versionInstalled}`);
    return versionInstalled == releaseVersion;
  }

  logger.silly(`${DATA_API_BUILDER_COMMAND} is not installed.`);
  return undefined;
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
 * @param command package to know the version
 * @returns installed version
 */
async function getInstalledVersion(command: "dab"): Promise<string | undefined> {
  logger.silly(`Running ${DATA_API_BUILDER_COMMAND} --version`);

  try {
    const { stdout } = await promisify(exec)(`${command} --version`);
    const version = stdout.split(" ")[1].split("\r")[0]; // parsing output which looks like this "Microsoft.DataApiBuilder 0.5.0" (specific to dab)

    return version;
  } catch {
    return undefined;
  }
}
