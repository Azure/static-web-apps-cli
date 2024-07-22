import fs from "node:fs";
import path from "node:path";
import {
  DATA_API_BUILDER_BINARY_NAME,
  DATA_API_BUILDER_DATABASE_TYPES,
  DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME,
  DATA_API_BUILDER_DEFAULT_FOLDER,
  DATA_API_BUILDER_DEFAULT_REST_PATH,
  DATA_API_BUILDER_DEFAULT_SCHEMA_FILE_NAME,
  DEFAULT_DATA_API_BUILDER_SCHEMA_CONTENT,
} from "../../../../core/constants.js";
import { execFileCommand } from "../../../../core/utils/command.js";
import { logger } from "../../../../core/utils/logger.js";
import { getDataApiBuilderBinaryPath } from "../../../../core/dataApiBuilder/index.js";

export async function init(options: SWACLIConfig) {
  let { databaseType, connectionString, cosmosdb_nosqlContainer, cosmosdb_nosqlDatabase } = options;

  if (databaseType === undefined || !isValidDatabaseType(databaseType)) {
    logger.error(
      `--database-type is a required field. Please provide the type of the database you want to connect (mssql, postgresql, cosmosdb_nosql, mysql, cosmosdb_postgresql).`,
      true
    );
    return;
  }

  // 1. create folder swa-db-connections if it doesn't exist
  const folderName = options?.folderName ? options.folderName : DATA_API_BUILDER_DEFAULT_FOLDER;
  const directory = path.join(process.cwd(), folderName);

  if (!fs.existsSync(directory)) {
    logger.log(`Creating database connections configuration folder ${folderName}`, "swa");
    fs.mkdirSync(directory);
  } else {
    logger.log(`Folder ${folderName} already exists, using that folder for creating data-api files`, "swa");
  }

  // 2. create file staticwebapp.database.config.json by calling dab init and passing through options
  const configFile = path.join(directory, DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME);

  if (fs.existsSync(configFile)) {
    logger.error(`Config file ${configFile} already exists. Please provide a different name or remove the existing config file.`, true);
  }

  logger.log(`Creating ${DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME} configuration file`, "swa");

  const dataApiBinary = await getDataApiBuilderBinaryPath();
  if (!dataApiBinary) {
    logger.error(
      `Could not find or install ${DATA_API_BUILDER_BINARY_NAME} binary.
    If you already have data-api-builder installed, try running "dab init" directly to generate the config file. Exiting!!`,
      true
    );
  }

  let args: string[] = [
    "init",
    "--database-type",
    databaseType,
    "--config",
    DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME,
    "--rest.path",
    DATA_API_BUILDER_DEFAULT_REST_PATH,
  ];
  if (connectionString) {
    args = [...args, "--connection-string", connectionString];
  }

  if (cosmosdb_nosqlContainer) {
    args = [...args, "--cosmosdb_nosql-container", cosmosdb_nosqlContainer];

    if (databaseType != DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql) {
      logger.warn(`Database type is not ${DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql}, --cosmosdb_nosql-container will be ignored.`);
    }
  }

  if (cosmosdb_nosqlDatabase) {
    args = [...args, "--cosmosdb_nosql-database", cosmosdb_nosqlDatabase];

    if (databaseType != DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql) {
      logger.warn(`Database type is not ${DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql}, --cosmosdb_nosql-database will be ignored.`);
    }
  }

  if (databaseType === DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql) {
    if (!cosmosdb_nosqlDatabase) {
      logger.error(
        `--cosmosdb_nosql-database is required when database-type is cosmosdb_nosql, ${DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME} will not be created`,
        true
      );
    }
    // create file staticwebapp.database.schema.json directly if database type cosmosdb_nosql since needed argument
    const schemaFile = path.join(directory, DATA_API_BUILDER_DEFAULT_SCHEMA_FILE_NAME);

    if (fs.existsSync(schemaFile)) {
      logger.warn(`Schema file exists ${schemaFile}. This content will be replaced.`);
    }

    logger.info(`Creating ${DATA_API_BUILDER_DEFAULT_SCHEMA_FILE_NAME} schema file`, "swa");
    try {
      fs.writeFileSync(schemaFile, DEFAULT_DATA_API_BUILDER_SCHEMA_CONTENT);
    } catch (ex) {
      logger.warn(`Unable to write/modify schema file. Exception : ${ex}`);
    }
    args = [...args, "--graphql-schema", DATA_API_BUILDER_DEFAULT_SCHEMA_FILE_NAME];
  }

  // todo:DAB CLI doesn't return an error code when it fails, so we need to allow stdio to be inherited (this will be fixed in the March release)
  // It would be better to have our own logs since DAB CLI refers to itself in its success messages
  // which may lead to confusion for swa cli users ex: `SUGGESTION: Use 'dab add [entity-name] [options]' to add new entities in your config.`
  execFileCommand(dataApiBinary, directory, args);

  // not logging anything here since DAB CLI logs success messages or error messages and we can't catch an error
}

export function isValidDatabaseType(databaseType: string): boolean {
  if (
    databaseType == DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql ||
    databaseType == DATA_API_BUILDER_DATABASE_TYPES.CosmosDbPostGreSql ||
    databaseType == DATA_API_BUILDER_DATABASE_TYPES.MsSql ||
    databaseType == DATA_API_BUILDER_DATABASE_TYPES.MySql ||
    databaseType == DATA_API_BUILDER_DATABASE_TYPES.PostGreSql
  ) {
    return true;
  }
  return false;
}
