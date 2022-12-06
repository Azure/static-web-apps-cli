import { DATA_API_BUILDER_RELEASE_METADATA_URL, DATA_API_BUILDER_RELEASE_TAG } from "../constants";
import fetch from "node-fetch";
import { promisify } from "util";
import { exec } from "child_process";
import fs from "fs";
import os from "os";
import unzipper from "unzipper";
import path from "path";
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
export async function getDataApiBuilderPath(): Promise<{ binary: string }> {
  const platform = getPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform: ${os.platform()}`); // todo: can we write custom error messages
  }

  const releaseMetadata = (await getLatestDataApiBuilderMetadata()).releaseMetadata;
  if (releaseMetadata === undefined) {
    throw new Error(`Could not load ${DATA_API_BUILDER_BINARY_NAME} metadata from remote. Please check your internet connection.`); // should we throw error and stop or can we allow users to use local version
  }
  const isLatestVersionInstalled = await isLocalVersionInstalledAndLatest(releaseMetadata.versionId);

  if (isLatestVersionInstalled) {
    logger.silly(`Latest version of DAB is installed locally!`);
    // return the path
  } else {
    // todo: check if you already have locally downloaded package
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
    }

    return {
      binary: binaryPath,
    };
  }
  return {
    binary: DEFAULT_DAB_BINARY,
  };
}

/**
 * Fetches the latest version, metadata of DAB.exe from DATA_API_BUILDER_RELEASE_METADATA_URL
 * @returns DataApiBuilderReleaseMetadata
 */
async function getLatestDataApiBuilderMetadata(): Promise<{ releaseMetadata: DataApiBuilderReleaseMetadata | undefined }> {
  const response = await fetch(DATA_API_BUILDER_RELEASE_METADATA_URL);
  const responseMetadata = (await response.json()) as DataApiBuilderReleaseMetadata;
  const releaseMetadata = responseMetadata;
  if (releaseMetadata.releaseType == DATA_API_BUILDER_RELEASE_TAG) {
    return {
      releaseMetadata: releaseMetadata,
    };
  } else {
    return {
      releaseMetadata: undefined,
    };
  }
  // This code will be used after the latest version of DABCLI manifest file release
  // if(responseMetadata.length >= 1 && Array.isArray(responseMetadata)){
  //   const releaseMetadata = responseMetadata.find((c) => c.releaseType === "released")
  //   return {
  //     releaseMetadata: releaseMetadata
  //   };
  // }
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
  // todo: delete unzip file after extraction
  const unZipPromise = new Promise(() => {
    fs.createReadStream(zipFilePath).pipe(unzipper.Extract({ path: destDirectory }));
  });

  await unZipPromise
    .then(() => {
      logger.silly(`Unzipping successful to the folder : ${destDirectory}`);
    })
    .catch(() => {
      logger.silly(`Unable to unzip the ${zipFilePath}`);
    });
}
