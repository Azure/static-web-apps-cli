const fs = require("node:fs");

if (!process.env.SWA_COMPAT_REPORT) throw new Error("SWA_COMPAT_REPORT is required.");

const args = process.argv.slice(2);
fs.appendFileSync(
  process.env.SWA_COMPAT_REPORT,
  JSON.stringify({
    execPath: process.execPath,
    args,
    cwd: process.cwd(),
    wrapper: process.env.SWA_COMPAT_WRAPPER ?? null,
    probe: process.env.SWA_COMPAT_PROBE ?? null,
    context: process.env.SWA_COMPAT_CONTEXT ?? null,
  }) + "\n",
);
console.log(args.includes("--version") ? process.env.SWA_COMPAT_VERSION : "compatibility wrapper stdout");
process.exitCode = args.includes("--version") ? 0 : Number(process.env.SWA_COMPAT_EXIT ?? "0");
