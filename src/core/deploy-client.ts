import chalk from "chalk";
import crypto from "crypto";
import fs from "fs";
import fetch from "node-fetch";
import ora from "ora";
import os from "os";
import path from "path";
import { PassThrough } from "stream";
import { logger } from "./utils";

type StaticSiteClientReleaseMetadata = {
  version: "stable" | "latest";
  publishDate: string;
  files: {
    ["linux-x64"]: {
      url: string;
      sha256: string;
    };
    ["win-x64"]: {
      url: string;
      sha256: string;
    };
    ["osx-x64"]: {
      url: string;
      sha256: string;
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

export async function getDeployClientPath(): Promise<{ binary: string; version: string }> {
  const platform = getPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform: ${os.platform()}`);
  }

  const localClientMetadata = getLocalClientMetadata() as StaticSiteClientLocalMetadata;

  const remoteClientMetadata = await fetchLatestClientVersionDefinition();
  if (remoteClientMetadata === undefined) {
    throw new Error(`Could not load ${DEPLOY_BINARY_NAME} version information from remote. Please check your internet connection.`);
  }

  // if the latest version is the same as the local version, we can skip the download
  if (localClientMetadata) {
    if (!localClientMetadata.metadata || !localClientMetadata.binary || !localClientMetadata.checksum) {
      logger.warn("Local client metadata is invalid, will download latest version and override local metadata");
    } else {
      const localChecksum = localClientMetadata.checksum;
      const releaseChecksum = remoteClientMetadata.files[platform].sha256.toLowerCase();
      const remotePublishDate = remoteClientMetadata.publishDate;
      const localPublishDate = localClientMetadata.metadata.publishDate;

      if (remotePublishDate === localPublishDate) {
        if (localChecksum === releaseChecksum) {
          return {
            binary: localClientMetadata.binary,
            version: localPublishDate,
          };
        } else {
          logger.warn(`Checksum mismatch! Expected ${localChecksum}, got ${releaseChecksum}`);
        }
      } else {
        logger.warn(`${DEPLOY_BINARY_NAME} is outdated! Expected ${remotePublishDate}, got ${localPublishDate}`);
      }
    }
  }

  return {
    binary: await downloadAndValidateBinary(remoteClientMetadata, platform),
    version: remoteClientMetadata.publishDate,
  };
}

export function getLocalClientMetadata(): StaticSiteClientLocalMetadata | null {
  const binaryFilename = path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME);
  const metadataFilename = path.join(DEPLOY_FOLDER, `${DEPLOY_BINARY_NAME}.json`);
  if (fs.existsSync(DEPLOY_FOLDER) && fs.existsSync(binaryFilename) && fs.existsSync(metadataFilename)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFilename, "utf8"));
      return metadata;
    } catch (err) {
      logger.warn(`Could not read ${DEPLOY_BINARY_NAME} metadata: ${err}`);
      return null;
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

function getPlatform(): "win-x64" | "osx-x64" | "linux-x64" | null {
  switch (os.platform()) {
    case "win32":
      return "win-x64";
    case "darwin":
      return "osx-x64";
    case "linux":
      return "linux-x64";
    default:
      return null;
  }
}

export async function fetchLatestClientVersionDefinition(): Promise<StaticSiteClientReleaseMetadata | undefined> {
  const remoteVersionDefinitions: StaticSiteClientReleaseMetadata[] = await fetch(
    "https://swalocaldeploy.azureedge.net/downloads/versions.json"
  ).then((res) => res.json());
  if (Array.isArray(remoteVersionDefinitions) && remoteVersionDefinitions.length) {
    return remoteVersionDefinitions.find((versionDefinition) => versionDefinition?.version === "latest");
  }
  return undefined;
}

async function downloadAndValidateBinary(release: StaticSiteClientReleaseMetadata, platform: "win-x64" | "osx-x64" | "linux-x64") {
  const downloadUrl = release.files[platform!].url;
  const downloadFilename = path.basename(downloadUrl);
  let outputFile = path.join(DEPLOY_FOLDER, downloadFilename);

  if (!fs.existsSync(DEPLOY_FOLDER)) {
    fs.mkdirSync(DEPLOY_FOLDER, { recursive: true });
  }

  const url = release.files[platform].url;

  const spinner = ora({ prefixText: chalk.dim.gray(`[swa]`) });
  spinner.start(`Downloading ${url}@${release.version}`);

  const response = await fetch(url);
  const bodyStream = response.body.pipe(new PassThrough());

  return await new Promise<string>((resolve, reject) => {
    const isPosix = platform === "linux-x64" || platform === "osx-x64";
    const writableStream = fs.createWriteStream(outputFile, { mode: isPosix ? 0o755 : undefined });
    bodyStream.pipe(writableStream);

    writableStream.on("end", () => {
      bodyStream.end();
    });

    writableStream.on("finish", () => {
      const computedHash = computeChecksumfromFile(outputFile);
      const releaseChecksum = release.files[platform].sha256.toLocaleLowerCase();
      if (computedHash !== releaseChecksum) {
        reject(new Error(`Checksum mismatch! Expected ${computedHash}, got ${releaseChecksum}`));
        spinner.fail();
      } else {
        spinner.succeed();

        logger.silly(`Checksum match: ${computedHash}`);

        if (fs.existsSync(`${outputFile}.exe`)) {
          outputFile = `${outputFile}.exe`;
        }
        logger.silly(`Saved binary to ${outputFile}`, "swa");

        saveMetadata(release, outputFile, computedHash);

        resolve(outputFile);
      }
    });
  });
}

function saveMetadata(release: StaticSiteClientReleaseMetadata, binaryFilename: string, sha256: string) {
  const metatdaFilename = path.join(DEPLOY_FOLDER, `${DEPLOY_BINARY_NAME}.json`);
  const metdata: StaticSiteClientLocalMetadata = {
    metadata: release,
    binary: binaryFilename,
    checksum: sha256,
  };
  fs.writeFileSync(metatdaFilename, JSON.stringify(metdata));
  logger.silly(`Saved metadata to ${metatdaFilename}`, "swa");
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
