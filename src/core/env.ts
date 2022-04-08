import dotenv from "dotenv";
import { writeFile } from "fs/promises";
import path from "path";
import { ENV_FILENAME, GIT_IGNORE_FILENAME } from "./constants";
import { logger } from "./utils";
import { fileExists, readFileIfExists } from "./utils/fs";

/**
 * Gets or sets the environment variables from `process.env`.
 *
 * @param newEnvs A list of environment variables to merge into the `process.env` object
 * @returns The SWA CLI environment variables from the `process.env` object
 */
export function swaCLIEnv(...newEnvs: SWACLIEnv[]): SWACLIEnv {
  // Note: logger is not available in this context
  // use console.log instead

  let env: SWACLIEnv = {
    ...process.env,
  };

  for (const newEnv of newEnvs) {
    env = {
      ...env,
      ...newEnv,
    };
  }

  return env;
}

export async function readEnvFile() {
  logger.silly(`Reading env file`);

  let oldEnv = "";
  const envFile = path.join(process.cwd(), ENV_FILENAME);
  if (fileExists(envFile)) {
    oldEnv = (await readFileIfExists(envFile)) || "";
  }
  const buf = Buffer.from(oldEnv);
  return dotenv.parse(buf);
}

export async function saveEnvFileAndUpdateGitIgnore(key: string, value: string) {
  logger.silly(`Saving env key: ${key}`);

  let oldEnv = "";
  const envFile = path.join(process.cwd(), ENV_FILENAME);

  if (fileExists(envFile)) {
    oldEnv = (await readFileIfExists(envFile)) || "";
  }
  const buf = Buffer.from(oldEnv);
  const env = dotenv.parse(buf);

  if (env[key]) {
    logger.silly(`Overriding env key: ${key}`);
  }

  // TODO: let the user choose whether to override or not!
  env[key] = value;

  const envValues = [];
  for (let k in env) {
    envValues.push(`${k}="${env[k]}"`);
  }

  await writeFile(envFile, envValues.join("\n"));

  if (fileExists(GIT_IGNORE_FILENAME)) {
    logger.silly(`Updating ${GIT_IGNORE_FILENAME}`);

    const gitIgnoreFileContent = (await readFileIfExists(GIT_IGNORE_FILENAME)) || "";
    if (gitIgnoreFileContent.includes(".env")) {
      logger.silly(`${envFile} file already in ${GIT_IGNORE_FILENAME}. Skipping...`);
    } else {
      logger.silly(`Add ${ENV_FILENAME} to ${GIT_IGNORE_FILENAME}`);
      await writeFile(gitIgnoreFileContent, [gitIgnoreFileContent, ENV_FILENAME].join("\n"));
    }
  } else {
    logger.silly(`${GIT_IGNORE_FILENAME} was not found. Creating it, and add ${ENV_FILENAME} to it.`);
    await writeFile(GIT_IGNORE_FILENAME, envFile);
  }
}
