#!/usr/bin/env node
const { detectProjectFolders } = require("../dist/core/frameworks/detect");
process.env.SWA_CLI_DEBUG = "silly";
detectProjectFolders('.');
