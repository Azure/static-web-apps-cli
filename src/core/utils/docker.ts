import fs from "fs";

let inDocker: boolean | undefined;

function hasDockerEnv() {
  try {
    fs.accessSync("/.dockerenv");
    return true;
  } catch {
    return false;
  }
}

function hasDockerCGroup() {
  try {
    return fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker");
  } catch {
    return false;
  }
}

// Based on https://stackoverflow.com/questions/23513045/how-to-check-if-a-process-is-running-inside-docker-container
export const isRunningInDocker = () => inDocker ?? (inDocker = hasDockerEnv() || hasDockerCGroup());
