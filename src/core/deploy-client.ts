import fs from "fs";
import fetch from "node-fetch";
import os from "os";
import path from "path";
import { STATIC_SITE_CLIENT_RELEASE_METADATA_URL } from "./constants";
import { DEPLOY_BINARY_NAME, DEPLOY_FOLDER, downloadAndValidateBinary, getPlatform } from "./downloadBinary";
import { swaCLIEnv } from "./env";
import { logger } from "./utils";

type StaticSiteClientLocalMetadata = {
  metadata: StaticSiteClientReleaseMetadata;
  binary: string;
  checksum: string;
};

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
    binary: await downloadAndValidateBinary(remoteClientMetadata, "StaticSiteClient", DEPLOY_FOLDER, remoteClientMetadata.buildId, platform),
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
