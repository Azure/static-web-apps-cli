import path from "path";
import fs from "fs";
import { logger } from "./utils";
const { readFile, writeFile } = fs.promises;

export async function isGitProject() {
  const gitFolder = path.join(process.cwd(), ".git");
  return fs.existsSync(gitFolder);
}

export async function updateGitIgnore(entry: string) {
  if (!entry) {
    return false;
  }

  if (!isGitProject()) {
    logger.silly(`Not a git project. Skip updating .gitignore`);
    return false;
  }

  const gitIgnoreFile = path.join(process.cwd(), ".gitignore");
  const gitIgnoreFileExists = fs.existsSync(gitIgnoreFile);

  if (!gitIgnoreFileExists) {
    logger.silly(`No .gitignore file found. Skip updating .gitignore`);
    return false;
  }

  const gitIgnoreFileContent = await readFile(gitIgnoreFile, "utf8");
  const gitIgnoreFileLines = gitIgnoreFileContent.length ? gitIgnoreFileContent.split("\n") : [];
  const gitIgnoreFileLinesBeforeUpdate = gitIgnoreFileLines.length;

  if (!gitIgnoreFileContent.includes(entry)) {
    logger.silly(`Adding entry to .gitignore`);
    gitIgnoreFileLines.push(entry);
  }

  const gitIgnoreFileContentWithProjectDetails = gitIgnoreFileLines.join("\n");
  await writeFile(gitIgnoreFile, gitIgnoreFileContentWithProjectDetails, "utf8");

  if (gitIgnoreFileLinesBeforeUpdate < gitIgnoreFileLines.length) {
    return true;
  }

  return false;
}
