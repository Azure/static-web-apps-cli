import { DATA_API_BUILDER_RELEASE_METADATA_URL } from "../constants";
import fetch from "node-fetch";
import { promisify } from "util";
import { exec } from "child_process";
import os from "os";
import { logger } from "../utils";
import { DATA_API_BUILDER_BINARY_NAME, DATA_API_BUILDER_FOLDER, downloadAndValidateBinary, getPlatform } from "../downloadBinary";

const DEFAULT_DAB_BINARY = "dab.exe";

/**
 * Gets the filepath where the dab.exe is located
 *  - Gets the latest version from the manifest file
 *  - Checks if it is installed and is latest or not already -> Gets the installed path
 *  - Installs if not already present
 * @params null
 *
 * @returns binaryPath
 */
export async function getDataApiBuilderPath(): Promise<{ binary: string }> {
  const platform = getPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform: ${os.platform()}`);
  }

  const responseMetadata = await getLatestDataApiBuilderMetadata();
  const releaseMetadata = responseMetadata.releaseMetadata;
  if (releaseMetadata === undefined) {
    throw new Error(`Could not load ${DATA_API_BUILDER_BINARY_NAME} metadata from remote. Please check your internet connection.`);
  }
  const isLatestVersionInstalled = await isLocalVersionInstalledAndLatest(releaseMetadata.versionId);

  if (isLatestVersionInstalled) {
    logger.silly(`Latest version of DAB is installed locally!`);
    // return the path
  } else {
    // todo: check if you already have locally downloaded package
    logger.silly(`Downloading the newer version`);
    return {
      binary: await downloadAndValidateBinary(releaseMetadata, "DataApiBuilder", DATA_API_BUILDER_FOLDER, releaseMetadata?.versionId, platform),
    };
    // todo: unzip, install the dab and return that path
  }
  console.log(releaseMetadata);
  const binary = DEFAULT_DAB_BINARY;
  return {
    binary,
  };
}

/**
 * Fetches the latest version of DAB.exe from DATA_API_BUILDER_RELEASE_METADATA_URL
 * @returns DataApiBuilderReleaseMetadata
 */
async function getLatestDataApiBuilderMetadata(): Promise<{ releaseMetadata: DataApiBuilderReleaseMetadata | undefined }> {
  const response = await fetch(DATA_API_BUILDER_RELEASE_METADATA_URL);
  const responseMetadata = (await response.json()) as DataApiBuilderReleaseMetadata;
  const releaseMetadata = responseMetadata;
  // if(responseMetadata.length >= 1 && Array.isArray(responseMetadata)){
  //   const releaseMetadata = responseMetadata.find((c) => c.releaseType === "released")
  //   return {
  //     releaseMetadata: releaseMetadata
  //   };
  // }
  return {
    releaseMetadata: releaseMetadata,
  };
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
