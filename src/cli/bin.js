#!/usr/bin/env node
import { run } from "./index.js";

const args = process.argv;
run(args);
process.title = ["swa", ...args.slice(2)].join(" ");
