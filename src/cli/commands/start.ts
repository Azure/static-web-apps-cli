import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import builder from "../../core/builder";
import { isAcceptingTcpConnections, isHttpUrl, logger, parseUrl, readWorkflowFile, validateDevServerConfig } from "../../core/utils";

export async function start(startContext: string, options: SWACLIConfig) {
  let useAppDevServer = undefined;
  let useApiDevServer = undefined;

  if (isHttpUrl(startContext)) {
    useAppDevServer = await validateDevServerConfig(startContext);
    options.appArtifactLocation = useAppDevServer;
  } else {
    // start the emulator from a specific artifact folder, if folder exists
    if (await isAcceptingTcpConnections({ host: options.host, port: options.port! })) {
      logger.error(`Port ${options.port} is already used. Choose a different port.`, true);
    }

    if (fs.existsSync(startContext)) {
      options.appArtifactLocation = startContext;
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
  let [appLocation, appArtifactLocation, apiLocation] = [
    options.appLocation as string,
    options.appArtifactLocation as string,
    options.apiLocation as string,
  ];

  let apiPort = (options.apiPort || DEFAULT_CONFIG.apiPort) as number;
  let userConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation,
    appArtifactLocation,
    apiLocation,
  };

  // mix CLI args with the project's build workflow configuration (if any)
  // use any specific workflow config that the user might provide undef ".github/workflows/"
  // Note: CLI args will take precedence over workflow config
  userConfig = readWorkflowFile({
    userConfig,
  });

  const isApiLocationExistsOnDisk = fs.existsSync(userConfig?.apiLocation!);
  // parse the API URI port

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

  // set env vars for current command
  const envVarsObj = {
    SWA_CLI_DEBUG: options.verbose,
    SWA_CLI_API_PORT: `${apiPort}`,
    SWA_CLI_APP_LOCATION: userConfig?.appLocation as string,
    SWA_CLI_APP_ARTIFACT_LOCATION: userConfig?.appArtifactLocation as string,
    SWA_CLI_API_LOCATION: userConfig?.apiLocation as string,
    SWA_CLI_HOST: options.host,
    SWA_CLI_PORT: `${options.port}`,
    SWA_WORKFLOW_FILES: userConfig?.files?.join(","),
  };

  if (options.verbose?.includes("silly")) {
    // when silly level is set,
    // propagate debugging level to other tools using the DEBUG environment variable
    process.env.DEBUG = "*";
  }
  // merge SWA env variables with process.env
  process.env = { ...process.env, ...envVarsObj };

  const { env } = process;
  const concurrentlyCommands = [
    // start the reverse proxy
    { command: `node ${path.join(__dirname, "..", "..", "proxy", "server.js")}`, name: "swa", env, prefixColor: "gray.dim" },
  ];

  if (isApiLocationExistsOnDisk) {
    concurrentlyCommands.push(
      // serve the api, if it's available
      { command: serveApiCommand, name: "api", env, prefixColor: "gray.dim" }
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
      env: envVarsObj,
      commands: {
        app: concurrentlyCommands[0].command,
        api: concurrentlyCommands?.[1]?.command,
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
