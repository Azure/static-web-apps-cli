import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { createStartupScriptCommand, isAcceptingTcpConnections, isHttpUrl, logger, parseUrl, readWorkflowFile, getCoreToolsBinary, detectTargetCoreToolsVersion, getNodeMajorVersion } from "../../core";
import builder from "../../core/builder";
let packageInfo = require("../../../package.json");

export async function start(startContext: string, options: SWACLIConfig) {
  // WARNING:
  // environment variables are populated using values provided by the user to the CLI.
  // Code below doesn't have access to these environment variables which are defined later below.
  // Make sure this code (or code from utils) does't depend on environment variables!

  let useAppDevServer: string | undefined | null = undefined;
  let useApiDevServer: string | undefined | null = undefined;
  let startupCommand: string | undefined | null = undefined;

  // make sure the CLI default port is available before proceeding.
  if (await isAcceptingTcpConnections({ host: options.host, port: options.port! })) {
    logger.error(`Port ${options.port} is already used. Choose a different port.`, true);
  }

  if (isHttpUrl(startContext)) {
    useAppDevServer = startContext;
    options.outputLocation = useAppDevServer;
  } else {
    let outputLocationRelative = path.resolve(options.appLocation as string, startContext);
    // start the emulator from a specific artifact folder relative to appLocation, if folder exists
    if (fs.existsSync(outputLocationRelative)) {
      options.outputLocation = outputLocationRelative;
    }
    //check for artifact folder using the absolute location
    else if (fs.existsSync(startContext)) {
      options.outputLocation = startContext;
    } else {
      // prettier-ignore
      logger.error(
        `The dist folder "${outputLocationRelative}" is not found.\n` +
        `Make sure that this folder exists or use the --build option to pre-build the static app.`,
        true
      );
    }
  }

  if (options.apiLocation) {
    if (isHttpUrl(options.apiLocation)) {
      useApiDevServer = options.apiLocation;
      options.apiLocation = useApiDevServer;
    }
    // make sure api folder exists
    else if (fs.existsSync(options.apiLocation) === false) {
      logger.info(`Skipping API because folder "${options.apiLocation}" is missing`);
    }
  }

  // get the app and api artifact locations
  let [appLocation, outputLocation, apiLocation] = [options.appLocation as string, options.outputLocation as string, options.apiLocation as string];

  let apiPort = (options.apiPort || DEFAULT_CONFIG.apiPort) as number;
  let devserverTimeout = (options.devserverTimeout || DEFAULT_CONFIG.devserverTimeout) as number;

  let userWorkflowConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation,
    outputLocation,
    apiLocation,
  };

  // mix CLI args with the project's build workflow configuration (if any)
  // use any specific workflow config that the user might provide undef ".github/workflows/"
  // Note: CLI args will take precedence over workflow config
  userWorkflowConfig = readWorkflowFile({
    userWorkflowConfig,
  });

  const isApiLocationExistsOnDisk = fs.existsSync(userWorkflowConfig?.apiLocation!);

  // handle the API location config
  let serveApiCommand = "echo 'No API found. Skipping'";

  if (useApiDevServer) {
    serveApiCommand = `echo 'using API dev server at ${useApiDevServer}'`;

    // get the API port from the dev server
    apiPort = parseUrl(useApiDevServer)?.port;
  } else {
    if (options.apiLocation && userWorkflowConfig?.apiLocation) {
      // check if the func binary is globally available and if not, download it
      const funcBinary = await getCoreToolsBinary();
      if (!funcBinary) {
        const targetVersion = detectTargetCoreToolsVersion(getNodeMajorVersion());
        // prettier-ignore
        logger.error(
          `\nCould not find or install Azure Functions Core Tools.\n` +
          `Install Azure Functions Core Tools with:\n\n` +
          `  npm i -g azure-functions-core-tools@${targetVersion} --unsafe-perm true\n\n` +
          `See https://aka.ms/functions-core-tools for more information.`,
          true
        );
      }

      // serve the api if and only if the user provides a folder via the --api-location flag
      if (isApiLocationExistsOnDisk) {
        serveApiCommand = `cd "${userWorkflowConfig.apiLocation}" && ${funcBinary} start --cors "*" --port ${options.apiPort} ${
          options.funcArgs ?? ""
        }`;
      }
    }
  }

  if (options.ssl) {
    if (options.sslCert === undefined || options.sslKey === undefined) {
      logger.error(`SSL Key and SSL Cert are required when using HTTPS`, true);
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
    SWA_CLI_APP_LOCATION: userWorkflowConfig?.appLocation as string,
    SWA_CLI_OUTPUT_LOCATION: userWorkflowConfig?.outputLocation as string,
    SWA_CLI_API_LOCATION: userWorkflowConfig?.apiLocation as string,
    SWA_CLI_ROUTES_LOCATION: options.swaConfigLocation,
    SWA_CLI_HOST: options.host,
    SWA_CLI_PORT: `${options.port}`,
    SWA_WORKFLOW_FILES: userWorkflowConfig?.files?.join(","),
    SWA_CLI_APP_SSL: `${options.ssl}`,
    SWA_CLI_APP_SSL_CERT: options.sslCert,
    SWA_CLI_APP_SSL_KEY: options.sslKey,
    SWA_CLI_STARTUP_COMMAND: startupCommand as string,
    SWA_CLI_VERSION: packageInfo.version,
    SWA_CLI_DEVSERVER_TIMEOUT: `${devserverTimeout}`,
    SWA_CLI_OPEN: `${options.open}`,
  };

  // merge SWA env variables with process.env
  process.env = { ...process.env, ...envVarsObj };

  // INFO: from here code may access SWA CLI env vars.

  const { env } = process;
  const concurrentlyCommands: concurrently.CommandObj[] = [
    // start the reverse proxy
    { command: `node "${path.join(__dirname, "..", "..", "msha", "server.js")}"`, name: "swa", env, prefixColor: "gray.dim" },
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
      { command: `cd "${userWorkflowConfig?.appLocation}" && ${startupCommand}`, name: "run", env, prefixColor: "gray.dim" }
    );
  }

  if (options.build) {
    // run the app/api builds
    await builder({
      config: userWorkflowConfig as GithubActionWorkflow,
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
