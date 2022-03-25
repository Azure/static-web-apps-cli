import crypto from "crypto";
import fs from "fs";
import fetch from "node-fetch";
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

const DEPLOY_BINARY_NAME = "StaticSitesClient";
const DEPLOY_FOLDER = path.join(os.homedir(), ".swa", "deploy");

export async function getDeployClientPath(): Promise<string | undefined> {
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
    const localChecksum = localClientMetadata.checksum;
    const releaseChecksum = remoteClientMetadata.files[platform].sha256.toLowerCase();
    const remotePublishDate = remoteClientMetadata.publishDate;
    const localPublishDate = localClientMetadata.metadata.publishDate;

    if (remotePublishDate === localPublishDate) {
      if (localChecksum === releaseChecksum) {
        return localClientMetadata.binary;
      } else {
        logger.warn(`Checksum mismatch! Expected ${localChecksum}, got ${releaseChecksum}`);
      }
    } else {
      logger.warn(`${DEPLOY_BINARY_NAME} is outdated! Expected ${remotePublishDate}, got ${localPublishDate}`);
    }
  }

  return await downloadAndValidateBinary(remoteClientMetadata, platform);
}

function getLocalClientMetadata(): StaticSiteClientLocalMetadata | null {
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
  logger.log(`Downloading latest version client to ${outputFile}`, "deploy");
  logger.log(`Please wait...`, "deploy");

  const response = await fetch(url);
  const totalSize = Number(response.headers.get("content-length"));
  const bodyStream = response.body.pipe(new PassThrough());

  return await new Promise<string>((resolve, reject) => {
    const isPosix = platform === "linux-x64" || platform === "osx-x64";
    const writableStream = fs.createWriteStream(outputFile, { mode: isPosix ? 0o755 : undefined });
    bodyStream.pipe(writableStream);

    writableStream.on("end", () => {
      bodyStream.end();
    });

    writableStream.on("finish", () => {
      logger.log(`Downloaded ${totalSize} bytes`, "deploy");

      const computedHash = computeChecksumfromFile(outputFile);
      const releaseChecksum = release.files[platform].sha256.toLocaleLowerCase();
      if (computedHash !== releaseChecksum) {
        reject(new Error(`Checksum mismatch! Expected ${computedHash}, got ${releaseChecksum}`));
      } else {
        logger.log(`Checksum match: ${computedHash}`, "deploy");

        saveMetadata(release, outputFile, computedHash);

        if (fs.existsSync(`${outputFile}.exe`)) {
          outputFile = `${outputFile}.exe`;
        }

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
  logger.log(`Saved metadata to ${metatdaFilename}`, "deploy");
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
