import { Command } from "commander";
import open from "open";

export default function registerDocs(program: Command) {
  program
    .command("docs")
    .description("open Azure Static Web Apps CLI documentations")
    .action(async () => {
      await open("https://azure.github.io/static-web-apps-cli/");
    });
}
