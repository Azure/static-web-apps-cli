import chalk from "chalk";
import crypto from "node:crypto";
import fs from "node:fs";
import stp from "node:stream/promises";
import { fetchWithProxy as fetch } from "./utils/fetch-proxy.js";
import ora from "ora";
import path from "node:path";
import { PassThrough } from "node:stream";
import { DATA_API_BUILDER_BINARY_NAME, DATA_API_BUILDER_FOLDER, DEPLOY_BINARY_NAME, DEPLOY_FOLDER } from "./constants.js";
import { logger } from "./utils/logger.js";

/**
 * Downloads the binary to the given output folder
 * @param releaseMetadata binary metadata
 * @param binaryType StaticSiteClient or DataApiBuilder
 * @param outputFolder path to download the binary
 * @param id buildId or versionId
 * @param platform os: win-x64 or linux-x64 or osx-x64
 * @returns
 */
export async function downloadAndValidateBinary(
  releaseMetadata: BinaryMetadata,
  binaryName: string,
  outputFolder: string,
  id: string,
  platform: "win-x64" | "osx-x64" | "linux-x64",
) {
  const downloadFilename = path.basename(releaseMetadata.files[platform].url);
  const url = releaseMetadata.files[platform].url;
  const spinner = ora({ prefixText: chalk.dim.gray(`[swa]`) });

  spinner.start(`Downloading ${url}@${id}`);

  const response = await fetch(url);

  if (response.status !== 200) {
    spinner.fail();
    throw new Error(`Failed to download ${binaryName} binary from url ${url}. File not found (${response.status})`);
  }

  const bodyStream = response?.body?.pipe(new PassThrough());

  createBinaryDirectoryIfNotExists(id, outputFolder);

  const isPosix = platform === "linux-x64" || platform === "osx-x64";
  const outputFile = path.join(outputFolder, id, downloadFilename);

  const writableStream = fs.createWriteStream(outputFile, { mode: isPosix ? 0o755 : undefined });

  await stp.pipeline(bodyStream, writableStream);

  const computedHash = computeChecksumfromFile(outputFile).toLowerCase();
  const releaseChecksum = releaseMetadata.files[platform].sha.toLowerCase();
  if (computedHash !== releaseChecksum) {
    try {
      // in case of a failure, we remove the file
      fs.unlinkSync(outputFile);
    } catch {
      logger.silly(`Not able to delete ${downloadFilename}, please delete manually.`);
    }

    spinner.fail();
    throw new Error(`Checksum mismatch for ${binaryName}! Expected ${releaseChecksum}, got ${computedHash}.`);
  } else {
    spinner.succeed();

    logger.silly(`Checksum match: ${computedHash}`);
    logger.silly(`Saved binary to ${outputFile}`);

    saveMetadata(releaseMetadata, outputFile, computedHash, binaryName);
  }

  return outputFile;
}

/**
 * Creates the output folder for downloading the binary
 * @param version version
 * @param outputFolder path to download the binary
 */
function createBinaryDirectoryIfNotExists(version: string, outputFolder: string) {
  const deployPath = path.join(outputFolder, version);
  if (!fs.existsSync(deployPath)) {
    fs.mkdirSync(deployPath, { recursive: true });
  }
}

/**
 * Computes and returns the sha256 hash value for the given file
 * @param filePath filePath
 * @returns sha256 checksum of the file
 */
function computeChecksumfromFile(filePath: string | undefined): string {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(buffer);

  return hash.digest("hex");
}

/**
 *
 * @param release binary Metadata
 * @param binaryFileName binary file location
 * @param sha hash value
 * @param binaryType StaticSiteClient or DataApiBuilder
 */
function saveMetadata(release: BinaryMetadata, binaryFileName: string, sha: string, binaryName: string) {
  const downloadFolder = getFolderForSavingMetadata(binaryName);

  if (downloadFolder != null) {
    const metadataFileName = path.join(downloadFolder, `${binaryName}.json`);
    const metdata: LocalBinaryMetadata = {
      metadata: release,
      binary: binaryFileName,
      checksum: sha,
    };
    fs.writeFileSync(metadataFileName, JSON.stringify(metdata));
    logger.silly(`Saved metadata to ${metadataFileName}`);
  }
}

/**
 * Returns folder for saving binary metadata
 * @param binaryName
 * @returns folder
 */
function getFolderForSavingMetadata(binaryName: string): string | null {
  switch (binaryName) {
    case DEPLOY_BINARY_NAME:
      return DEPLOY_FOLDER;
    case DATA_API_BUILDER_BINARY_NAME:
      return DATA_API_BUILDER_FOLDER;
    default:
      return null;
  }
}
