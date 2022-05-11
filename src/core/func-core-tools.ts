import os from "os";
import fs from "fs";
import path from "path";
import process from "process";
import { exec } from "child_process";
import { promisify } from "util";
import { PassThrough } from "stream";
import crypto from "crypto";
import fetch from "node-fetch";
import unzipper from "unzipper";
import cliProgress from "cli-progress";
import { logger } from "./utils/logger";

const RELEASES_FEED_URL = "https://functionscdn.azureedge.net/public/cli-feed-v4.json";
const DEFAULT_FUNC_BINARY = "func";
const VERSION_FILE = ".release-version";
const CORE_TOOLS_FOLDER = ".swa/core-tools";

function getMajorVersion(version: string): number {
  return Number(version.split(".")[0]);
}

export function getNodeMajorVersion(): number {
  return getMajorVersion(process.versions.node);
}

function getCoreToolsDownloadFolder() {
  return path.join(os.homedir(), CORE_TOOLS_FOLDER);
}

function getCoreToolsFolder(version: number): string {
  const downloadFolder = getCoreToolsDownloadFolder();
  return path.join(downloadFolder, `v${version}`);
}

function getCoreToolBinaryPath(version: number): string {
  const folder = getCoreToolsFolder(version);
  return path.resolve(path.join(folder, "func"));
}

export function isCoreToolsVersionCompatible(coreToolsVersion: number, nodeVersion: number): boolean {
  // Runtime support reference: https://docs.microsoft.com/azure/azure-functions/functions-versions?pivots=programming-language-javascript#languages
  switch (coreToolsVersion) {
    case 4:
      return nodeVersion >= 14 && nodeVersion <= 16;
    case 3:
      return nodeVersion >= 10 && nodeVersion <= 14;
    case 2:
      return nodeVersion >= 8 && nodeVersion <= 10;
    default:
      return false;
  }
}

export function detectTargetCoreToolsVersion(nodeVersion: number): number {
  // Pick the highest version that is compatible with the specified Node version
  if (nodeVersion >= 14 && nodeVersion <= 16) return 4;
  if (nodeVersion >= 10 && nodeVersion < 14) return 3;
  if (nodeVersion >= 8 && nodeVersion < 10) return 2;

  // Fallback to the latest version for Unsupported Node version
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

  return fs.readFileSync(versionFile, "utf8");
}

function getPlatform() {
  switch (os.platform()) {
    case "win32":
      return "Windows";
    case "darwin":
      return "MacOS";
    case "linux":
      return "Linux";
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

export async function getLatestCoreToolsRelease(targetVersion: number): Promise<CoreToolsRelease> {
  try {
    const response = await fetch(RELEASES_FEED_URL);
    const feed = (await response.json()) as { releases: any; tags: any };
    const tag = feed.tags[`v${targetVersion}`];
    if (!tag || tag.hidden) {
      throw new Error(`Cannot find the latest version for v${targetVersion}`);
    }

    const release = feed.releases[tag.release];
    if (!release) {
      throw new Error(`Cannot find release for ${tag.release}`);
    }

    const coreTools = release.coreTools.filter((t: CoreToolsZipInfo) => t.size === "full");
    const platform = getPlatform();
    const info = coreTools.find((t: CoreToolsZipInfo) => t.OS === platform);
    if (!info) {
      throw new Error(`Cannot find download package for ${platform}`);
    }

    return {
      version: tag.release,
      url: info.downloadLink,
      sha2: info.sha2,
    };
  } catch (error: unknown) {
    throw new Error(`Error fetching Function Core Tools releases: ${(error as Error).message}`);
  }
}

async function downloadAndUnzipPackage(release: CoreToolsRelease, dest: string) {
  const progressBar = new cliProgress.Bar(
    {
      format: "{bar} {percentage}% | ETA: {eta}s",
    },
    cliProgress.Presets.shades_classic
  );
  try {
    const response = await fetch(release.url);
    const totalSize = Number(response.headers.get("content-length"));

    let downloadedSize = 0;
    let since = Date.now();
    progressBar.start(totalSize, downloadedSize);

    const bodyStream1 = response?.body?.pipe(new PassThrough());
    const bodyStream2 = response?.body?.pipe(new PassThrough());

    bodyStream2?.on("data", (chunk) => {
      downloadedSize += chunk.length;
      const now = Date.now();
      if (now - since > 100) {
        progressBar.update(downloadedSize);
        since = now;
      }
    });

    const unzipPromise = new Promise((resolve, reject) => {
      const unzipperInstance = unzipper.Extract({ path: dest });
      unzipperInstance.promise().then(resolve, reject);
      bodyStream2?.pipe(unzipperInstance);
    });

    const hash = await new Promise((resolve) => {
      const hash = crypto.createHash("sha256");
      hash.setEncoding("hex");
      bodyStream1?.on("end", () => {
        hash.end();
        resolve(hash.read());
      });
      bodyStream1?.pipe(hash);
    });

    await unzipPromise;

    if (hash !== release.sha2) {
      throw new Error(`Downloaded Core Tools SHA2 mismatch: expected ${hash}, got ${release.sha2}`);
    }
  } finally {
    progressBar.stop();
  }
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

  try {
    await downloadAndUnzipPackage(release, dest);
  } catch (error) {
    // Clean up the folder if the download failed
    removeDownloadedCoreTools(version);
    throw error;
  }

  // Fix permissions on MacOS/Linux
  if (os.platform() === "linux" || os.platform() === "darwin") {
    fs.chmodSync(path.join(dest, "func"), 0o755);
    fs.chmodSync(path.join(dest, "gozip"), 0o755);
  }

  fs.writeFileSync(path.join(dest, VERSION_FILE), release.version);

  return release.version;
}

export async function getCoreToolsBinary(): Promise<string | undefined> {
  const nodeVersion = getNodeMajorVersion();
  const systemVersion = await getInstalledSystemCoreToolsVersion();

  if (systemVersion && isCoreToolsVersionCompatible(systemVersion, nodeVersion)) {
    return DEFAULT_FUNC_BINARY;
  }

  const targetVersion = detectTargetCoreToolsVersion(nodeVersion);
  const downloadedVersion = getDownloadedCoreToolsVersion(targetVersion);
  if (downloadedVersion) {
    // Should we check for newer versions here?
    return getCoreToolBinaryPath(targetVersion);
  }

  if (systemVersion && systemVersion !== targetVersion) {
    logger.warn(`Functions Core Tools version mismatch. Detected v${systemVersion} but requires v${targetVersion}`);
    logger.warn(`Downloading v${targetVersion}...`);
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
    console.log(error);
    return undefined;
  }
}

export function removeDownloadedCoreTools(version?: number) {
  // If not specified, remove all versions
  const folder = version ? getCoreToolsFolder(version) : getCoreToolsDownloadFolder();
  if (fs.existsSync(folder)) {
    const rm = fs.rmSync ? fs.rmSync : fs.rmdirSync;
    rm(folder, { recursive: true });
  }
}
