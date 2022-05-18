import { Command } from "commander";
import open from "open";

export default function registerCommand(program: Command) {
  program
    .command("docs")
    .description("Open Azure Static Web Apps CLI documentations")
    .action(async () => {
      await open("https://azure.github.io/static-web-apps-cli/");
    });
}
