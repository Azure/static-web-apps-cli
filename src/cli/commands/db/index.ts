import { Command } from "commander";
import buildInitCommand from "./init";

export default function registerDbCommands(program: Command) {
  const dbCommand = program.command("db [command] [options]").description("Manage your database");
  dbCommand.addCommand(buildInitCommand()).copyInheritedSettings; // For supporting dab init
}
