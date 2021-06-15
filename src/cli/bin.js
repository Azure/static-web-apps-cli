#!/usr/bin/env node
const args = process.argv;
const { run } = require('./index');
run(args);
process.title = ["swa", ...args.slice(2)].join(" ");
