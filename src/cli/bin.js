#!/usr/bin/env node
const args = process.argv.slice(2);
const cli = require('./index');
cli.run(args);
process.title = ["swa", ...args].join(" ");
