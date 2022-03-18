import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import fetch from "node-fetch";
import { logger } from "./utils";

type StaticSiteClientVersionDefinition = {
  version: string;
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

const DEPLOY_BINARY_NAME = "StaticSitesClient";
const DEPLOY_FOLDER = path.join(os.homedir(), ".swa", "deploy");

export async function downloadClient(): Promise<string | undefined> {
  const platform = getPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform: ${os.platform()}`);
  }
  const localClientVersion = getLocalClientVersionDefinition();
  const remoteClientVersion = await fetchLatestClientVersionDefinition();

  // if the latest version is the same as the local version, we can skip the download
  if (localClientVersion) {
    if (remoteClientVersion?.publishDate === localClientVersion?.version?.publishDate) {
      if (computeSHA256fromFile(localClientVersion?.binary) === remoteClientVersion?.files[platform!].sha256.toLocaleLowerCase()) {
        logger.info(`${DEPLOY_BINARY_NAME} is up to date (${localClientVersion?.version?.publishDate}).`);
        return localClientVersion?.binary;
      }
    }
  }

  if (remoteClientVersion === undefined) {
    throw new Error(`Could not load ${DEPLOY_BINARY_NAME} version information`);
    return;
  }

  if (localClientVersion?.version.publishDate !== remoteClientVersion.publishDate) {
    const downloadUrl = remoteClientVersion.files[platform!].url;
    const downloadFilename = path.basename(downloadUrl);
    const downloadPath = path.join(DEPLOY_FOLDER, downloadFilename);

    logger.info(`Downloading ${downloadUrl} to ${downloadPath}`);

    fs.mkdirSync(DEPLOY_FOLDER, { recursive: true });

    const abort = new AbortController();
    try {
      await fetch(downloadUrl, {
        signal: abort.signal,
      })
        .then((res) => res.buffer())
        .then((buffer) => fs.writeFileSync(downloadPath, buffer));
    } catch (err) {
      throw new Error(`Could not download ${DEPLOY_BINARY_NAME}: ${err}`);
      return;
    }

    const isPosix = platform === "linux-x64" || platform === "osx-x64";
    if (isPosix) {
      fs.chmodSync(downloadPath, 0o755);
    }

    fs.writeFileSync(path.join(DEPLOY_FOLDER, `${DEPLOY_BINARY_NAME}.json`), JSON.stringify(remoteClientVersion, null, 2));

    logger.info(`Binary saved to ${downloadPath}`);
  }

  let binary = path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME);
  if (fs.existsSync(`${binary}.exe`)) {
    binary = `${binary}.exe`;
  }

  if (computeSHA256fromFile(binary) === remoteClientVersion?.files[platform!].sha256.toLocaleLowerCase()) {
    logger.info(`${DEPLOY_BINARY_NAME} was updated to ${remoteClientVersion?.publishDate}.`);
    return binary;
  }

  return undefined;
}

function getLocalClientVersionDefinition() {
  const binaryFilename = path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME);
  const versionFilename = path.join(DEPLOY_FOLDER, `${DEPLOY_BINARY_NAME}.json`);
  if (fs.existsSync(DEPLOY_FOLDER) && fs.existsSync(binaryFilename) && fs.existsSync(versionFilename)) {
    try {
      const version: StaticSiteClientVersionDefinition = JSON.parse(fs.readFileSync(versionFilename, "utf8"));
      return {
        binary: binaryFilename,
        version,
      };
    } catch (err) {
      logger.warn(`Could not read ${DEPLOY_BINARY_NAME} configuration: ${err}`);
      return null;
    }
  }

  return null;
}

function computeSHA256fromFile(filePath: string | undefined): string {
  if (!filePath) {
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
      throw new Error(`Cannot deploy because of unsupported platform: ${os.platform()}`);
  }
}

export async function fetchLatestClientVersionDefinition() {
  const remoteVersionDefinitions: StaticSiteClientVersionDefinition[] = await fetch(
    "https://swalocaldeploy.azureedge.net/downloads/versions.json"
  ).then((res) => res.json());
  if (Array.isArray(remoteVersionDefinitions) && remoteVersionDefinitions.length) {
    return remoteVersionDefinitions.find((versionDefinition) => versionDefinition?.version === "latest");
  }
  return undefined;
}
