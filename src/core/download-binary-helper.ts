import chalk from "chalk";
import crypto from "crypto";
import fs from "fs";
import fetch from "node-fetch";
import ora from "ora";
import os from "os";
import path from "path";
import { PassThrough } from "stream";
import { logger } from "./utils";

export const DEPLOY_BINARY_NAME = "StaticSitesClient";
export const DEPLOY_FOLDER = path.join(os.homedir(), ".swa", "deploy");
export const DATA_API_BUILDER_BINARY_NAME = "DataApiBuilder";
export const DATA_API_BUILDER_FOLDER = path.join(os.homedir(), ".swa", "dab");

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
  binaryType: "StaticSiteClient" | "DataApiBuilder", // todo: move these strings to constants
  outputFolder: string,
  id: string,
  platform: "win-x64" | "osx-x64" | "linux-x64" // todo: same here
) {
  const downloadFilename = path.basename(releaseMetadata.files[platform!].url);
  const binaryName = binaryType == "StaticSiteClient" ? DEPLOY_BINARY_NAME : DATA_API_BUILDER_BINARY_NAME;
  const url = releaseMetadata.files[platform].url;

  const spinner = ora({ prefixText: chalk.dim.gray(`[swa]`) });

  spinner.start(`Downloading ${url}@${id}`);

  const response = await fetch(url);

  if (response.status !== 200) {
    spinner.fail();
    throw new Error(`Failed to download ${binaryName} binary. File not found (${response.status})`);
  }

  const bodyStream = response?.body?.pipe(new PassThrough());

  createBinaryDirectoryIfNotExists(id, outputFolder);

  return await new Promise<string>((resolve, reject) => {
    const isPosix = platform === "linux-x64" || platform === "osx-x64";
    let outputFile = path.join(outputFolder, id, downloadFilename);

    const writableStream = fs.createWriteStream(outputFile, { mode: isPosix ? 0o755 : undefined });
    bodyStream?.pipe(writableStream);

    writableStream.on("end", () => {
      bodyStream?.end();
    });

    writableStream.on("finish", async () => {
      const computedHash = computeChecksumfromFile(outputFile).toLowerCase();
      const releaseChecksum = releaseMetadata.files[platform].sha.toLocaleLowerCase();
      if (computedHash !== releaseChecksum) {
        try {
          // in case of a failure, we remove the file
          fs.unlinkSync(outputFile);
        } catch {}

        spinner.fail();
        reject(new Error(`Checksum mismatch! Expected ${computedHash}, got ${releaseChecksum}.`));
      } else {
        spinner.succeed();

        logger.silly(`Checksum match: ${computedHash}`);
        logger.silly(`Saved binary to ${outputFile}`);

        saveMetadata(releaseMetadata, outputFile, computedHash, binaryType);

        resolve(outputFile);
      }
    });
  });
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
 * @param binaryFilename binary file location
 * @param sha hash value
 * @param binaryType StaticSiteClient or DataApiBuilder
 */
function saveMetadata(release: BinaryMetadata, binaryFilename: string, sha: string, binaryType: string) {
  const downloadFolder = binaryType == "StaticSiteClient" ? DEPLOY_FOLDER : DATA_API_BUILDER_FOLDER;
  const binaryName = binaryType == "StaticSiteClient" ? DEPLOY_BINARY_NAME : DATA_API_BUILDER_BINARY_NAME;
  const metadataFilename = path.join(downloadFolder, `${binaryName}.json`);
  const metdata: LocalBinaryMetadata = {
    metadata: release,
    binary: binaryFilename,
    checksum: sha,
  };
  fs.writeFileSync(metadataFilename, JSON.stringify(metdata));
  logger.silly(`Saved metadata to ${metadataFilename}`);
}

/**
 * Returns the os of the platform
 * @returns current os
 */
export function getPlatform(): "win-x64" | "osx-x64" | "linux-x64" | null {
  switch (os.platform()) {
    case "win32":
      return "win-x64";
    case "darwin":
      return "osx-x64";
    case "aix":
    case "freebsd":
    case "openbsd":
    case "sunos":
    case "linux":
      return "linux-x64";
    default:
      return null;
  }
}
