import fs from "node:fs";
import { fetchWithProxy as fetch } from "./utils/fetch-proxy.js";
import os from "node:os";
import path from "node:path";
import { STATIC_SITE_CLIENT_RELEASE_METADATA_URL, DEPLOY_BINARY_NAME, DEPLOY_FOLDER, DEPLOY_BINARY_STABLE_TAG } from "./constants.js";
import { downloadAndValidateBinary } from "./download-binary-helper.js";
import { swaCLIEnv } from "./env.js";
import { logger } from "./utils/logger.js";
import { getPlatform } from "./utils/platform.js";

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
  const binaryVersion = swaCLIEnv().SWA_CLI_DEPLOY_BINARY_VERSION || DEPLOY_BINARY_STABLE_TAG;
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
    binary: await downloadAndValidateBinary(remoteClientMetadata, DEPLOY_BINARY_NAME, DEPLOY_FOLDER, remoteClientMetadata.buildId, platform),
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

  try {
    logger.silly(`GET ${STATIC_SITE_CLIENT_RELEASE_METADATA_URL}`);
    const response = await fetch(STATIC_SITE_CLIENT_RELEASE_METADATA_URL);
    if (!response.ok) {
      logger.silly(`Response.status = ${response.status} ${response.statusText}`);
      return undefined;
    }
    const remoteVersionDefinitions = (await response.json()) as StaticSiteClientReleaseMetadata[];
    logger.silly(`Decode JSON: ${JSON.stringify(remoteVersionDefinitions, null, 2)}`);
    if (Array.isArray(remoteVersionDefinitions) && remoteVersionDefinitions.length) {
      const releaseMetadata = remoteVersionDefinitions.find((v) => v?.version === releaseVersion);
      logger.silly(`Release Metadata for ${releaseVersion}: ${JSON.stringify(releaseMetadata, null, 2)}`);
      return releaseMetadata;
    }
  } catch (err) {
    logger.silly(`Error fetching release metadata: ${err}`);
  }

  logger.silly(`Could not find release metadata; returning undefined`);
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
