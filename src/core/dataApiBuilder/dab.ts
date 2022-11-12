import { DATA_API_BUILDER_RELEASE_METADATA_URL } from "../constants";
import fetch from "node-fetch";
import { promisify } from "util";
import { exec } from "child_process";
import os from "os";
import { logger } from "../utils";
import { DATA_API_BUILDER_BINARY_NAME, DATA_API_BUILDER_FOLDER, downloadAndValidateBinary, getPlatform } from "../downloadBinary";

const DEFAULT_DAB_BINARY = "dab";

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

  const isLatestVersionInstalled = await isLocalVersionInstalledAndLatest();
  const releaseMetadata = await getLatestDataApiBuilderMetadata();
  if (releaseMetadata.releaseMetadata === undefined) {
    throw new Error(`Could not load ${DATA_API_BUILDER_BINARY_NAME} metadata from remote. Please check your internet connection.`);
  }

  if (isLatestVersionInstalled) {
    logger.silly(`Latest version of DAB is installed locally!`);
    // return the path
  } else {
    logger.silly(`Downloading the newer version`);
    return {
      binary: await downloadAndValidateBinary(
        releaseMetadata.releaseMetadata,
        "DataApiBuilder",
        DATA_API_BUILDER_FOLDER,
        releaseMetadata.releaseMetadata?.versionId,
        platform
      ),
    };
    // install the dab and return that path
  }
  console.log(releaseMetadata);
  const binary = "regatte";
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

async function isLocalVersionInstalledAndLatest(): Promise<boolean | undefined> {
  try {
    // todo : fix this
    const { stdout: version } = await promisify(exec)(`${DEFAULT_DAB_BINARY} --version`);
    console.log(version);
    // console.error(stderr);
    return false;
    // return stdout === releaseMetadata.releaseMetadata?.version;
  } catch (ex) {
    return false;
  }
}
