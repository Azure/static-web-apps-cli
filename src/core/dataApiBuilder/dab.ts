import { DATA_API_BUILDER_RELEASE_METADATA_URL, DATA_API_BUILDER_RELEASE_TAG } from "../constants";
import fetch from "node-fetch";
import { promisify } from "util";
import { exec } from "child_process";
import fs from "fs";
import os from "os";
import unzipper from "unzipper";
import path from "path";
import { PassThrough } from "stream";
import { logger } from "../utils";
import { DATA_API_BUILDER_BINARY_NAME, DATA_API_BUILDER_FOLDER, downloadAndValidateBinary, getPlatform } from "../download-binary-helper";

const DEFAULT_DAB_BINARY = "dab.exe";

/**
 * Gets the filepath where the dab.exe is located
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
    throw new Error(`Unsupported platform: ${os.platform()}`); // todo: can we write custom error messages
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
    binaryPath: DEFAULT_DAB_BINARY,
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
    const destDirectory = path.join(DATA_API_BUILDER_FOLDER, releaseMetadata?.versionId);
    const binaryPath = path.join(destDirectory, DEFAULT_DAB_BINARY);

    if (!fs.existsSync(binaryPath)) {
      logger.silly(`Downloading the newer version`);
      const zipFilePath = await downloadAndValidateBinary(
        releaseMetadata,
        "DataApiBuilder",
        DATA_API_BUILDER_FOLDER,
        releaseMetadata?.versionId,
        platform
      );

      await extractBinary(zipFilePath, destDirectory);
      // todo: delete zip file and delete older versions of dab-files??
    }
    return binaryPath;
  } catch (ex) {
    logger.error(`Unable to download/extract dab binary. Exception ${ex}`);
    return undefined;
  }
}

/**
 * Fetches the latest version, metadata of DAB.exe from DATA_API_BUILDER_RELEASE_METADATA_URL
 * @returns DataApiBuilderReleaseMetadata
 */
async function getReleaseDataApiBuilderMetadata(): Promise<{ releaseMetadata: DataApiBuilderReleaseMetadata | undefined }> {
  const response = await fetch(DATA_API_BUILDER_RELEASE_METADATA_URL);
  const responseMetadata = (await response.json()) as DataApiBuilderReleaseMetadata;

  if (Array.isArray(responseMetadata)) {
    const releaseMetadata = responseMetadata.find((c) => c.releaseType === DATA_API_BUILDER_RELEASE_TAG);

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
 * @param releaseVersion current released Version of the DAB.exe
 * @returns true if latest Version of dab is installed else false
 */
async function isLocalVersionInstalledAndLatest(releaseVersion: string): Promise<boolean | undefined> {
  logger.silly(`Running dab --version`);
  try {
    // todo: fix this
    const { stdout, stderr } = await promisify(exec)(`${DEFAULT_DAB_BINARY} --version`);

    if (stderr) {
      logger.silly(stderr);
    }

    logger.silly(stdout);
    const version = stdout.split(" ")[1].split("\r")[0];

    return version === releaseVersion;
  } catch (ex: any) {
    logger.silly(ex.stdout);
    try {
      const version = ex.stdout.split(" ")[1].split("\r")[0];
      return version === releaseVersion;
    } catch (ex) {
      return false;
    }
  }
}

/**
 * Unzips the given file to destDirectory
 * @param zipFilePath file to unzip
 * @param destDirectory directory to extract
 */
async function extractBinary(zipFilePath: string, destDirectory: string) {
  // todo: delete zip file after extraction

  const openAsStream = fs.createReadStream(zipFilePath).pipe(new PassThrough());
  const unzipPromise = new Promise((resolve, reject) => {
    const unzipperInstance = unzipper.Extract({ path: destDirectory });
    unzipperInstance.promise().then(resolve, reject);
    openAsStream?.pipe(unzipperInstance);
  });

  await unzipPromise;
}
