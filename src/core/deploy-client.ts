import chalk from "chalk";
import crypto from "crypto";
import fs from "fs";
import fetch from "node-fetch";
import ora from "ora";
import os from "os";
import path from "path";
import { PassThrough } from "stream";
import { STATIC_SITE_CLIENT_RELEASE_METADATA_URL } from "./constants";
import { swaCLIEnv } from "./env";
import { logger } from "./utils";

type StaticSiteClientReleaseMetadata = {
  version: "stable" | "latest";
  buildId: string;
  publishDate: string;
  files: {
    ["linux-x64"]: {
      url: string;
      sha: string;
    };
    ["win-x64"]: {
      url: string;
      sha: string;
    };
    ["osx-x64"]: {
      url: string;
      sha: string;
    };
  };
};

type StaticSiteClientLocalMetadata = {
  metadata: StaticSiteClientReleaseMetadata;
  binary: string;
  checksum: string;
};

export const DEPLOY_BINARY_NAME = "StaticSitesClient";
export const DEPLOY_FOLDER = path.join(os.homedir(), ".swa", "deploy");

export async function getDeployClientPath(): Promise<{ binary: string; buildId: string }> {
  const platform = getPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform: ${os.platform()}`);
  }

  const localClientMetadata = getLocalClientMetadata() as StaticSiteClientLocalMetadata;
  const binaryVersion = swaCLIEnv().SWA_CLI_DEPLOY_BINARY_VERSION || "stable";
  const remoteClientMetadata = await fetchClientVersionDefinition(binaryVersion);
  if (remoteClientMetadata === undefined) {
    throw new Error(`Could not load ${DEPLOY_BINARY_NAME} metadata from remote. Please check your internet connection.`);
  }

  // if the latest version is the same as the local version, we can skip the download
  if (localClientMetadata) {
    if (!localClientMetadata.metadata || !localClientMetadata.binary || !localClientMetadata.checksum) {
      logger.warn(`Local client metadata is invalid!`);
    } else {
      const localChecksum = localClientMetadata.checksum;
      const releaseChecksum = remoteClientMetadata.files[platform].sha.toLowerCase();
      const remoteBuildId = remoteClientMetadata.buildId;
      const localBuildId = localClientMetadata.metadata.buildId;

      if (remoteBuildId === localBuildId) {
        if (localChecksum === releaseChecksum) {
          logger.silly(`Local client binary is up to date. Skipping download.`);
          return {
            binary: localClientMetadata.binary,
            buildId: localBuildId,
          };
        } else {
          logger.warn(`Local metatada contains invalid checksum hash!`);
          logger.warn(`  Expected ${releaseChecksum}`);
          logger.warn(`  Received ${localChecksum}`);
        }
      } else {
        if (localBuildId) {
          logger.warn(`${DEPLOY_BINARY_NAME} is outdated! Expected ${remoteBuildId}, got ${localBuildId}`);
        }
      }
    }
  }

  return {
    binary: await downloadAndValidateBinary(remoteClientMetadata, platform),
    buildId: remoteClientMetadata.buildId,
  };
}

export function getLocalClientMetadata(): StaticSiteClientLocalMetadata | null {
  const metadataFilename = path.join(DEPLOY_FOLDER, `${DEPLOY_BINARY_NAME}.json`);

  if (!fs.existsSync(metadataFilename)) {
    logger.warn(`Could not find ${DEPLOY_BINARY_NAME} local binary`);
    return null;
  }

  let metadata: StaticSiteClientLocalMetadata | null = null;

  try {
    metadata = JSON.parse(fs.readFileSync(metadataFilename, "utf8"));
  } catch (err) {
    logger.warn(`Could not read ${DEPLOY_BINARY_NAME} metadata: ${err}`);
    return null;
  }

  if (metadata) {
    if (!fs.existsSync(metadata.binary)) {
      logger.warn(`Could not find ${DEPLOY_BINARY_NAME} binary: ${metadata.binary}`);
      return null;
    } else if (fs.existsSync(metadata.binary)) {
      return metadata;
    }
  }

  return null;
}

function computeChecksumfromFile(filePath: string | undefined): string {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

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

export async function fetchClientVersionDefinition(releaseVersion: string): Promise<StaticSiteClientReleaseMetadata | undefined> {
  logger.silly(`Fetching release metadata for version: ${releaseVersion}. Please wait...`);

  const remoteVersionDefinitions = (await fetch(STATIC_SITE_CLIENT_RELEASE_METADATA_URL).then((res) =>
    res.json()
  )) as StaticSiteClientReleaseMetadata[];
  if (Array.isArray(remoteVersionDefinitions) && remoteVersionDefinitions.length) {
    const releaseMetadata = remoteVersionDefinitions.find((versionDefinition) => versionDefinition?.version === releaseVersion);

    logger.silly(releaseMetadata!);

    return releaseMetadata;
  }
  return undefined;
}

async function downloadAndValidateBinary(release: StaticSiteClientReleaseMetadata, platform: "win-x64" | "osx-x64" | "linux-x64") {
  const downloadUrl = release.files[platform!].url;
  const downloadFilename = path.basename(downloadUrl);

  const url = release.files[platform].url;
  const buildId = release.buildId;

  const spinner = ora({ prefixText: chalk.dim.gray(`[swa]`) });

  spinner.start(`Downloading ${url}@${buildId}`);

  const response = await fetch(url);

  if (response.status !== 200) {
    spinner.fail();
    throw new Error(`Failed to download ${DEPLOY_BINARY_NAME} binary. File not found (${response.status})`);
  }

  const bodyStream = response?.body?.pipe(new PassThrough());

  createDeployDirectoryIfNotExists(buildId);

  return await new Promise<string>((resolve, reject) => {
    const isPosix = platform === "linux-x64" || platform === "osx-x64";
    let outputFile = path.join(DEPLOY_FOLDER, buildId, downloadFilename);

    const writableStream = fs.createWriteStream(outputFile, { mode: isPosix ? 0o755 : undefined });
    bodyStream?.pipe(writableStream);

    writableStream.on("end", () => {
      bodyStream?.end();
    });

    writableStream.on("finish", () => {
      const computedHash = computeChecksumfromFile(outputFile).toLowerCase();
      const releaseChecksum = release.files[platform].sha.toLocaleLowerCase();
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

        saveMetadata(release, outputFile, computedHash);

        resolve(outputFile);
      }
    });
  });
}

function saveMetadata(release: StaticSiteClientReleaseMetadata, binaryFilename: string, sha: string) {
  const metatdaFilename = path.join(DEPLOY_FOLDER, `${DEPLOY_BINARY_NAME}.json`);
  const metdata: StaticSiteClientLocalMetadata = {
    metadata: release,
    binary: binaryFilename,
    checksum: sha,
  };
  fs.writeFileSync(metatdaFilename, JSON.stringify(metdata));
  logger.silly(`Saved metadata to ${metatdaFilename}`);
}

// TODO: get StaticSiteClient to remove zip files
// TODO: can these ZIPs be created under /tmp?
export function cleanUp() {
  const clean = (file: string) => {
    const filepath = path.join(process.cwd(), file);
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch {}
    }
  };

  clean(".\\app.zip");
  clean(".\\api.zip");
}

function createDeployDirectoryIfNotExists(version: string) {
  const deployPath = path.join(DEPLOY_FOLDER, version);
  if (!fs.existsSync(deployPath)) {
    fs.mkdirSync(deployPath, { recursive: true });
  }
}
