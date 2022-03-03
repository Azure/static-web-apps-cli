import os from 'os';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import cliProgress from 'cli-progress';
import { logger } from "./utils/logger";

const RELEASES_FEED_URL = 'https://functionscdn.azureedge.net/public/cli-feed-v4.json';
const DEFAULT_FUNC_BINARY = 'func';
const VERSION_FILE = '.release-version';
const LOCAL_CORE_TOOLS_FOLDER = '.swa/core-tools';
const NODE_MAJOR_VERSION = getMajorVersion(process.versions.node);

function getMajorVersion(version: string): number {
  return Number(version.split('.')[0]);
};

function getCoreToolsDownloadFolder() {
  return path.join(os.homedir(), LOCAL_CORE_TOOLS_FOLDER);
}

function getCoreToolsFolder(version: number): string {
  const downloadFolder = getCoreToolsDownloadFolder();
  return path.join(downloadFolder, `v${version}`);
}

function getCoreToolBinaryPath(version: number): string {
  const folder = getCoreToolsFolder(version);
  return path.resolve(path.join(folder, 'func'));
}

export function detectTargetCoreToolsVersion(): number {
  // Runtime support reference: https://docs.microsoft.com/azure/azure-functions/functions-versions?pivots=programming-language-javascript#languages
  if (NODE_MAJOR_VERSION >= 14 && NODE_MAJOR_VERSION <= 16) return 4;
  if (NODE_MAJOR_VERSION >= 10 && NODE_MAJOR_VERSION < 14) return 3;
  if (NODE_MAJOR_VERSION >= 8 && NODE_MAJOR_VERSION < 10) return 2;

  logger.warn(`Unsupported Node version: ${NODE_MAJOR_VERSION} for Functions Core Tools`);
  return 4;
}

async function getInstalledSystemCoreToolsVersion(): Promise<number | undefined> {
  try {
    const { stdout: version } = await promisify(exec)(`${DEFAULT_FUNC_BINARY} --version`);
    return getMajorVersion(version);
  } catch {
    return undefined;
  }
}

function getDownloadedCoreToolsVersion(targetVersion: number): string | undefined {
  const folder = getCoreToolsFolder(targetVersion);
  if (!fs.existsSync(folder)) {
    return undefined;
  }

  const versionFile = path.join(folder, VERSION_FILE);
  if (!fs.existsSync(versionFile)) {
    // Cannot detect downloaded version, in doubt cleanup the folder
    removeDownloadedCoreTools(targetVersion);
    return undefined;
  }

  return fs.readFileSync(versionFile, 'utf8');
}

function getPlatform() {
  switch (os.platform()) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'MacOS';
    case 'linux':
      return 'Linux';
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

export async function getLatestCoreToolsRelease(targetVersion: number): Promise<CoreToolsRelease> {
  try {
    const response = await fetch(RELEASES_FEED_URL);
    const feed = await response.json();
    const tag = feed.tags[`v${targetVersion}`];
    if (!tag || tag.hidden) {
      throw new Error(`Cannot find the latest version for v${targetVersion}`);
    }

    const release = feed.releases[tag.release];
    if (!release) {
      throw new Error(`Cannot find release for ${tag.release}`);
    }

    const coreTools = release.coreTools.filter((t: CoreToolsZipInfo) => t.size === 'full');
    const platform = getPlatform();
    const info = coreTools.find((t: CoreToolsZipInfo) => t.OS === platform);
    if (!info) {
      throw new Error(`Cannot find download package for ${platform}`);
    }
    
    return {
      version: tag.release,
      url: info.downloadLink
    };
  } catch (error: unknown) {
    throw new Error(`Error fetching Function Core Tools releases: ${(error as Error).message}`);
  }
}

async function downloadAndUnzipPackage(url: string, dest: string) {
  const response = await fetch(url);
  const totalSize = Number(response.headers.get('content-length'));
  const progressBar = new cliProgress.Bar({
    format: '{bar} {percentage}% | ETA: {eta}s',
  }, cliProgress.Presets.shades_classic);
  let downloadedSize = 0;
  let since = Date.now();
  progressBar.start(totalSize, downloadedSize);

  response.body.on('data', (chunk) => {
    downloadedSize += chunk.length
    const now = Date.now();
    if (now - since > 100) {
      progressBar.update(downloadedSize);
      since = now;
    }
  });

  await new Promise((resolve, reject) => {
    const unzipperInstance = unzipper.Extract({ path: dest });
    unzipperInstance.promise().then(resolve, reject);
    response.body.pipe(unzipperInstance);
  });
}

export async function downloadCoreTools(version: number): Promise<string> {
  const dest = getCoreToolsFolder(version);
  const release = await getLatestCoreToolsRelease(version);

  // Make sure we start from a clean folder
  if (fs.existsSync(dest)) {
    removeDownloadedCoreTools(version);
  } else {
    fs.mkdirSync(dest, { recursive: true });
  }

  await downloadAndUnzipPackage(release.url, dest);

  // Fix permissions on MacOS/Linux
  if (os.platform() === 'linux' || os.platform() === 'darwin') {
    fs.chmodSync(path.join(dest, 'func'), 0o755);
    fs.chmodSync(path.join(dest, 'gozip'), 0o755);
  }

  fs.writeFileSync(path.join(dest, VERSION_FILE), release.version);

  return release.version;
}

export async function getCoreToolsBinary(): Promise<string | undefined> {
  const targetVersion = detectTargetCoreToolsVersion();
  const systemVersion = await getInstalledSystemCoreToolsVersion();

  if (systemVersion && systemVersion === targetVersion) {
    return DEFAULT_FUNC_BINARY;
  }

  const downloadedVersion = getDownloadedCoreToolsVersion(targetVersion);
  if (downloadedVersion) {
    // Should we check for newer versions here?

    return getCoreToolBinaryPath(targetVersion);
  }

  if (systemVersion && systemVersion !== targetVersion) {
    logger.warn(`Functions Core Tools version mismatch. Detected v${systemVersion} but requires v${targetVersion}`);
    logger.warn(`Downloading v${targetVersion}...`)
  }

  if (!systemVersion) {
    logger.warn(`Functions Core Tools not detected. Downloading v${targetVersion}...`);
  }

  try {
    await downloadCoreTools(targetVersion);
    logger.log(`\nDownloaded Function Core Tools successfully`);
    return getCoreToolBinaryPath(targetVersion);
  } catch (error: unknown) {
    logger.error(`Failed to download Functions Core Tools v${targetVersion}.`);
    logger.error(error as Error);
    return undefined;
  }
}

export function removeDownloadedCoreTools(version?: number) {
  // If not specified, remove all versions
  const folder = version ? getCoreToolsFolder(version) : getCoreToolsDownloadFolder();
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true });
  }
}
