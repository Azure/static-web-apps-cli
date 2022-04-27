#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Usage: node detect.js [path] [<folder_depth_to_analyze>]
// Small utility to test framework detection against a folder structure.
// ---------------------------------------------------------------------------

const fs = require("fs").promises;
const path = require("path");
const { detectProjectFolders, formatDetectedFolders } = require("../dist/core/frameworks/detect");

const invoked = path.basename(process.argv[1], path.extname(process.argv[1])) === 'detect';

async function getFolders(rootPath, depth = -1) {
  if (depth === 0) {
    return [];
  }
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const folders = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(rootPath, entry.name);
    return entry.isDirectory()
      ? [...(depth === 1 ? [entryPath] : []), ...(await getFolders(entryPath, depth - 1))]
      : [];
  }));
  return folders.flat();
}

async function detect(rootPath, depth) {
  if (process.env.DEBUG) {
    process.env.SWA_CLI_DEBUG = "silly";
  }
  let out = '';
  const folders = await detectProjectFolders(rootPath);
  const alphaCompare = (a, b) => a.rootPath.localeCompare(b.rootPath);
  folders.api.sort(alphaCompare);
  folders.app.sort(alphaCompare);
  out += formatDetectedFolders(folders.api, 'api') + '\n';
  out += formatDetectedFolders(folders.app, 'app');

  if (depth > 0) {
    let undetectedFolders = await getFolders(rootPath, depth);
    undetectedFolders = undetectedFolders.filter(
      f => !folders.api.some(api => api.rootPath.startsWith(f)) && !folders.app.some(app => app.rootPath.startsWith(f))
    );
    out += `\nUndetected folders (${undetectedFolders.length}):\n`;
    out += undetectedFolders.length ? `- ${undetectedFolders.join("\n- ")}` : '';
  }
  if (invoked) {
    console.log(out);
  }

  return out;
}

// Launch detection when invoked directly
if (invoked) {
  const args = process.argv.slice(2);
  let dir = '.';
  let depth = -1;
  if (args.length === 1) {
    const value = Number(args[0]);
    if (Number.isNaN(value)) {
      dir = args[0];
    } else {
      depth = value;
    }
  } else {
    dir = args[0];
    depth = Number(args[1]);
  }
  detect(dir, depth);
}

module.exports = detect;
