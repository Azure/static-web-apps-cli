import { Command } from "commander";
import { configureOptions } from "../../../core";
import { telemetry } from "./telemetry";

export default function registerCommand(program: Command) {
  program
    .command("telemetry")
    .usage("[options]")
    .description("enable/disable SWA CLI telemetry capturing")
    .option("-dt, --disable", "opt out of telemetry", undefined)
    .option("-et, --enable", "opt in telemetry", undefined)
    .option("-st, --status", "status of telemetry", undefined)
    .action(async (_options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(undefined, command.optsWithGlobals(), command, "telemetry");
      await telemetry(options);
    });
}
