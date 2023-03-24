import { logger, execFileCommand } from "../../../../core";
import { init, isValidDatabaseType } from "./init";
import path from "path";
import {
  DATA_API_BUILDER_DATABASE_TYPES,
  DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME,
  DATA_API_BUILDER_DEFAULT_FOLDER,
} from "../../../../core/constants";
import fs from "fs";

// Replace the imported functions with mocks for testing purposes
jest.mock("../../../../core/dataApiBuilder", () => ({
  getDataApiBuilderBinaryPath: jest.fn(() => "dataApiBuilderPath"),
}));
jest.mock("../../../../core", () => ({
  fs: {
    existsSync: jest.fn(() => false),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
  },
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
  execFileCommand: jest.fn(),
}));

describe("init", () => {
  beforeEach(() => {
    // Reset the mocked functions before each test
    jest.clearAllMocks();
  });

  it("should log an error and return if databaseType is undefined", async () => {
    const options = {};

    await init(options);

    expect(logger.error).toHaveBeenCalledWith(
      `--database-type is a required field. Please provide the type of the database you want to connect (mssql, postgresql, cosmosdb_nosql, mysql, cosmosdb_postgresql).`,
      true
    );
  });

  it("should log an error and return if databaseType is invalid", async () => {
    const options = { databaseType: "invalidDatabaseType" };

    await init(options);

    expect(logger.error).toHaveBeenCalledWith(
      `--database-type is a required field. Please provide the type of the database you want to connect (mssql, postgresql, cosmosdb_nosql, mysql, cosmosdb_postgresql).`,
      true
    );
  });

  it("should log an error and return if databaseType is empty string", async () => {
    const options = { databaseType: "" };

    await init(options);

    expect(logger.error).toHaveBeenCalledWith(
      `--database-type is a required field. Please provide the type of the database you want to connect (mssql, postgresql, cosmosdb_nosql, mysql, cosmosdb_postgresql).`,
      true
    );
  });

  it("should create the folder if it doesn't exist", async () => {
    const options = { databaseType: "mssql" };
    const directory = path.join(process.cwd(), DATA_API_BUILDER_DEFAULT_FOLDER);
    const fsExistsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
    const fsMkdirSyncSpy = jest.spyOn(fs, "mkdirSync").mockReturnValue("");

    await init(options);

    expect(fsExistsSyncSpy).toHaveBeenCalledTimes(2);
    expect(fsMkdirSyncSpy).toHaveBeenCalledWith(directory);
    expect(logger.log).toHaveBeenCalledWith(`Creating database connections configuration folder ${DATA_API_BUILDER_DEFAULT_FOLDER}`, "swa");
  });

  it("should create the custom folder if it doesn't exist", async () => {
    const customFolderName = "customFolderName";
    const options = { databaseType: "mssql", folderName: customFolderName };
    const directory = path.join(process.cwd(), customFolderName);
    const fsExistsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
    const fsMkdirSyncSpy = jest.spyOn(fs, "mkdirSync").mockReturnValue("");

    await init(options);

    expect(fsExistsSyncSpy).toHaveBeenCalledTimes(2);
    expect(fsMkdirSyncSpy).toHaveBeenCalledWith(directory);
    expect(logger.log).toHaveBeenCalledWith(`Creating database connections configuration folder ${customFolderName}`, "swa");
  });

  it("should not create the folder if it already exists", async () => {
    const options = { databaseType: "mssql", folderName: "existingFolder" };
    const fsExistsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
    const fsMkdirSyncSpy = jest.spyOn(fs, "mkdirSync").mockReturnValue("");

    await init(options);

    expect(fsExistsSyncSpy).toHaveBeenCalledTimes(2);
    expect(fsMkdirSyncSpy).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(`Folder existingFolder already exists, using that folder for creating data-api files`, "swa");
  });

  it("should log an error and return if the config file already exists", async () => {
    const options = { databaseType: "mssql" };
    const directory = path.join(process.cwd(), DATA_API_BUILDER_DEFAULT_FOLDER);
    const configFile = path.join(directory, DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME);
    const fsExistsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const fsWriteFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockReturnValue();

    await init(options);

    expect(fsExistsSyncSpy).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Config file ${configFile} already exists. Please provide a different name or remove the existing config file.`,
      true
    );
    expect(fsWriteFileSyncSpy).not.toHaveBeenCalled();
    expect(execFileCommand).toHaveBeenCalled();
  });

  it("should create config file if it doesn't exist", async () => {
    const options = { databaseType: "mssql" };
    const directory = path.join(process.cwd(), DATA_API_BUILDER_DEFAULT_FOLDER);
    const configFile = path.join(directory, DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME);
    const fsExistsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);

    await init(options);

    expect(fsExistsSyncSpy).toHaveBeenCalledTimes(2);
    expect(execFileCommand).toHaveBeenCalled();
    expect(fsExistsSyncSpy).toHaveBeenCalledWith(configFile);
  });

  it("should print warning when --cosmosdb_nosql-container is provided but database type is not cosmosdb_nosql", async () => {
    const options = { databaseType: "mssql", cosmosdb_nosqlContainer: "xyz" };

    await init(options);

    expect(logger.warn).toHaveBeenCalledWith(
      `Database type is not ${DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql}, --cosmosdb_nosql-container will be ignored.`
    );
  });

  it("should print warning when --cosmosdb_nosql-database is provided but database type is not cosmosdb_nosql", async () => {
    const options = { databaseType: "mssql", cosmosdb_nosqlDatabase: "xyz" };

    await init(options);

    expect(logger.warn).toHaveBeenCalledWith(
      `Database type is not ${DATA_API_BUILDER_DATABASE_TYPES.CosmosDbNoSql}, --cosmosdb_nosql-database will be ignored.`
    );
  });

  it("should print error when --cosmosdb_nosql-database is not provided when database type is cosmosdb_nosql", async () => {
    const options = { databaseType: "cosmosdb_nosql" };

    await init(options);

    expect(logger.error).toHaveBeenCalledWith(
      `--cosmosdb_nosql-database is required when database-type is cosmosdb_nosql, ${DATA_API_BUILDER_DEFAULT_CONFIG_FILE_NAME} will not be created`,
      true
    );
  });
});

describe("isValidDatabaseType", () => {
  it("returns true for valid database types", () => {
    expect(isValidDatabaseType("mssql")).toBe(true);
    expect(isValidDatabaseType("postgresql")).toBe(true);
    expect(isValidDatabaseType("cosmosdb_nosql")).toBe(true);
    expect(isValidDatabaseType("mysql")).toBe(true);
    expect(isValidDatabaseType("cosmosdb_postgresql")).toBe(true);
  });

  it("returns false for invalid database types", () => {
    expect(isValidDatabaseType("invalid")).toBe(false);
    expect(isValidDatabaseType("")).toBe(false);
  });
});
