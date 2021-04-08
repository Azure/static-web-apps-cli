#!/usr/bin/env node
const args = process.argv.slice(2);
const cli = require('./index');
cli.main(args);
process.title = ["swa", ...args].join(" ");
