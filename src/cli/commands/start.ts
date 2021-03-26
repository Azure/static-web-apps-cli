import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import builder from "../../core/builder";
import {
  createStartupScriptCommand,
  isAcceptingTcpConnections,
  isHttpUrl,
  logger,
  parseUrl,
  readWorkflowFile,
  validateDevServerConfig,
} from "../../core/utils";

export async function start(startContext: string, options: SWACLIConfig) {
  // WARNING: code below doesn't have access to SWA CLI env vars which are defined later below
  // make sure this code (or code from utils) does't depend on SWA CLI env vars!

  let useAppDevServer: string | undefined | null = undefined;
  let useApiDevServer: string | undefined | null = undefined;
  let startupCommand: string | undefined | null = undefined;

  if (isHttpUrl(startContext)) {
    useAppDevServer = await validateDevServerConfig(startContext);
    options.outputLocation = useAppDevServer;
  } else {
    // start the emulator from a specific artifact folder, if folder exists
    if (await isAcceptingTcpConnections({ host: options.host, port: options.port! })) {
      logger.error(`Port ${options.port} is already used. Choose a different port.`, true);
    }

    if (fs.existsSync(startContext)) {
      options.outputLocation = startContext;
    } else {
      // prettier-ignore
      logger.error(
        `The dist folder "${startContext}" is not found.\n` +
        `Make sure that this folder exists or use the --build option to pre-build the static app.`,
        true
      );
    }
  }

  if (options.apiLocation) {
    if (isHttpUrl(options.apiLocation)) {
      useApiDevServer = await validateDevServerConfig(options.apiLocation);
      options.apiLocation = useApiDevServer;
    }
    // make sure api folder exists
    else if (fs.existsSync(options.apiLocation) === false) {
      logger.info(`Skipping API because folder "${options.apiLocation}" is missing.`);
    }
  }

  // get the app and api artifact locations
  let [appLocation, outputLocation, apiLocation] = [options.appLocation as string, options.outputLocation as string, options.apiLocation as string];

  let apiPort = (options.apiPort || DEFAULT_CONFIG.apiPort) as number;
  let userConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation,
    outputLocation,
    apiLocation,
  };

  // mix CLI args with the project's build workflow configuration (if any)
  // use any specific workflow config that the user might provide undef ".github/workflows/"
  // Note: CLI args will take precedence over workflow config
  userConfig = readWorkflowFile({
    userConfig,
  });

  const isApiLocationExistsOnDisk = fs.existsSync(userConfig?.apiLocation!);

  // handle the API location config
  let serveApiCommand = "echo No API found. Skipping";

  if (useApiDevServer) {
    serveApiCommand = `echo 'using API dev server at ${useApiDevServer}'`;

    // get the API port from the dev server
    apiPort = parseUrl(useApiDevServer)?.port;
  } else {
    if (options.apiLocation && userConfig?.apiLocation) {
      // @todo check if the func binary is globally available
      const funcBinary = "func";
      // serve the api if and only if the user provides a folder via the --api-location flag
      if (isApiLocationExistsOnDisk) {
        serveApiCommand = `cd ${userConfig.apiLocation} && ${funcBinary} start --cors * --port ${options.apiPort}`;
      }
    }
  }

  if (options.ssl) {
    if (options.sslCert === undefined || options.sslKey === undefined) {
      logger.error(`SSL Key or SSL Cert are required when using HTTPS`, true);
    }
  }

  if (options.run) {
    startupCommand = createStartupScriptCommand(options.run, options);
  }

  // WARNING: code from above doesn't have access to env vars which are only defined below

  // set env vars for current command
  const envVarsObj = {
    SWA_CLI_DEBUG: options.verbose,
    SWA_CLI_API_PORT: `${apiPort}`,
    SWA_CLI_APP_LOCATION: userConfig?.appLocation as string,
    SWA_CLI_APP_ARTIFACT_LOCATION: userConfig?.outputLocation as string,
    SWA_CLI_API_LOCATION: userConfig?.apiLocation as string,
    SWA_CLI_HOST: options.host,
    SWA_CLI_PORT: `${options.port}`,
    SWA_WORKFLOW_FILES: userConfig?.files?.join(","),
    SWA_CLI_APP_SSL: `${options.ssl}`,
    SWA_CLI_APP_SSL_CERT: options.sslCert,
    SWA_CLI_APP_SSL_KEY: options.sslKey,
    SWA_CLI_STARTUP_COMMAND: startupCommand as string,
  };

  // merge SWA env variables with process.env
  process.env = { ...process.env, ...envVarsObj };

  // INFO: from here code may access SWA CLI env vars.

  const { env } = process;
  const concurrentlyCommands: concurrently.CommandObj[] = [
    // start the reverse proxy
    { command: `node ${path.join(__dirname, "..", "..", "proxy", "server.js")}`, name: "swa", env, prefixColor: "gray.dim" },
  ];

  if (isApiLocationExistsOnDisk) {
    concurrentlyCommands.push(
      // serve the api, if it's available
      { command: serveApiCommand, name: "api", env, prefixColor: "gray.dim" }
    );
  }

  if (startupCommand) {
    concurrentlyCommands.push(
      // run an external script, if it's available
      { command: `cd ${userConfig?.appLocation} && ${startupCommand}`, name: "run", env, prefixColor: "gray.dim" }
    );
  }

  if (options.build) {
    // run the app/api builds
    await builder({
      config: userConfig as GithubActionWorkflow,
    });
  }

  logger.silly(
    {
      ssl: [options.ssl, options.sslCert, options.sslKey],
      env: envVarsObj,
      commands: {
        swa: concurrentlyCommands.find((c) => c.name === "swa")?.command,
        api: concurrentlyCommands.find((c) => c.name === "api")?.command,
        run: concurrentlyCommands.find((c) => c.name === "run")?.command,
      },
    },
    "swa"
  );

  await concurrently(concurrentlyCommands, {
    restartTries: 0,
    prefix: "name",
  }).then(
    () => process.exit(),
    () => process.exit()
  );
}
