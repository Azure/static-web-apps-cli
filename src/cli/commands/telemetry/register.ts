import { Command } from "commander";
import { configureOptions } from "../../../core";
import { telemetry } from "./telemetry";

export default function registerCommand(program: Command) {
  program
    .command("telemetry")
    .usage("[options]")
    .description("manage SWA CLI telemetry capturing")
    .option("-dt, --disable", "opt out of telemetry capturing", undefined)
    .option("-et, --enable", "opt in telemetry capturing", undefined)
    .option("-st, --status", "status of telemetry capturing", undefined)
    .action(async (_options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(undefined, command.optsWithGlobals(), command, "telemetry");
      await telemetry(options);
    });
}
