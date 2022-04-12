import path from "path";
import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import { logger } from "./utils";

async function isGitProject() {
  const gitIgnoreFile = path.join(process.cwd(), ".git");
  return fs.existsSync(gitIgnoreFile);
}

export async function updateGitIgnore(entry: string) {
  if (!isGitProject()) {
    logger.silly(`Not a git project. Skip updating .gitignore`);
    return;
  }

  const gitIgnoreFile = path.join(process.cwd(), ".gitignore");
  const gitIgnoreFileExists = fs.existsSync(gitIgnoreFile);
  const gitIgnoreFileContent = gitIgnoreFileExists ? await readFile(gitIgnoreFile, "utf8") : "";
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
