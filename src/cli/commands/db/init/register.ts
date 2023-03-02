import { Command } from "commander";
import { configureOptions } from "../../../../core/utils";
import { init } from "./init";
import { DEFAULT_CONFIG } from "../../../../config";

export default function registerCommand(program: Command) {
  const dbCommand = program.command("db [command] [options]").description("Manage your database");
  const dbInitCommand = new Command()
    .command("init")
    .usage("[options]")
    .description("initialize database connection configurations for your static web app")
    .requiredOption(
      "-t, --database-type <database type>",
      "(Required) The type of the database you want to connect (mssql, postgresql, cosmosdb_nosql, mysql, cosmosdb_postgresql)."
    )
    .option(
      "-f, --folder-name <folder name>",
      "A folder name to override the convention database connection configuration folder name (ensure that you update your CI/CD workflow files accordingly).",
      DEFAULT_CONFIG.folderName
    )
    .option("-cs, --connection-string <connection string>", "The connection string of the database you want to connect.")
    .option(
      "-nd, --cosmosdb_nosql-database <cosmosdb nosql database>",
      "The database of your cosmosdb account you want to connect (only needed if using cosmosdb_nosql database type)."
    )
    .option("-nc, --cosmosdb_nosql-container <cosmosdb nosql container>", "The container of your cosmosdb account you want to connect.")
    .action(async (_options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(undefined, command.optsWithGlobals(), command, "db init", false);

      await init(options);
    })
    .addHelpText(
      "after",
      `
Examples:
swa db init --database-type mssql --connection-string $YOUR_CONNECTION_STRING_ENV

swa db init --database-type cosmosdb_nosql --cosmosdb_nosql-database myCosmosDB --connection-string $YOUR_CONNECTION_STRING_ENV
  `
    );

  dbCommand.addCommand(dbInitCommand).copyInheritedSettings; // For supporting dab init
}
