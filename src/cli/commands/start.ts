import chalk from "chalk";
import { Command, Option } from "commander";
import concurrently from "concurrently";
import { CommandInfo } from "concurrently/dist/src/command";
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import {
  configureOptions,
  createStartupScriptCommand,
  detectTargetCoreToolsVersion,
  getCoreToolsBinary,
  getNodeMajorVersion,
  isAcceptingTcpConnections,
  isCoreToolsVersionCompatible,
  isHttpUrl,
  logger,
  parseDevserverTimeout,
  parsePort,
  parseUrl,
  readWorkflowFile,
} from "../../core";
import builder from "../../core/builder";
import { swaCLIEnv } from "../../core/env";
let packageInfo = require("../../../package.json");

export default function registerCommand(program: Command) {
  program
    .command("start [context]")
    .usage("[context] [options]")
    .description("Start the emulator from a directory or bind to a dev server")
    .option("--app-location <appLocation>", "the folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("--api-location <apiLocation>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option<number>("--api-port <apiPort>", "the API server port passed to `func start`", parsePort, DEFAULT_CONFIG.apiPort)
    .option("--host <host>", "the host address to use for the CLI dev server", DEFAULT_CONFIG.host)
    .option<number>("--port <port>", "the port value to use for the CLI dev server", parsePort, DEFAULT_CONFIG.port)

    // hide this flag from the help output
    .addOption(new Option("--build", "build the front-end app and API before starting the emulator").default(false).hideHelp())

    .option("--ssl", "serve the front-end application and API over HTTPS", DEFAULT_CONFIG.ssl)
    .option("--ssl-cert <sslCertLocation>", "the SSL certificate (.crt) to use when enabling HTTPS", DEFAULT_CONFIG.sslCert)
    .option("--ssl-key <sslKeyLocation>", "the SSL key (.key) to use when enabling HTTPS", DEFAULT_CONFIG.sslKey)
    .option("--run <startupScript>", "run a custom shell command or script file at startup", DEFAULT_CONFIG.run)
    .option<number>(
      "--devserver-timeout <devserverTimeout>",
      "the time to wait (in ms) when connecting to a front-end application's dev server",
      parseDevserverTimeout,
      DEFAULT_CONFIG.devserverTimeout
    )

    .option("--open", "open the browser to the dev server", DEFAULT_CONFIG.open)
    .option("--func-args <funcArgs>", "pass additional arguments to the func start command")
    .action(async (context: string = `.${path.sep}`, _options: SWACLIConfig, command: Command) => {
      console.warn(chalk.yellow("************************************************************************"));
      console.warn(chalk.yellow("* WARNING: This emulator is currently in preview and may not match the *"));
      console.warn(chalk.yellow("* cloud environment exactly. Always deploy and test your app in Azure. *"));
      console.warn(chalk.yellow("************************************************************************"));
      console.warn();

      const config = await configureOptions(context, command.optsWithGlobals(), command);
      await start(config.context, config.options);
    })
    .addHelpText(
      "after",
      `
Examples:

Serve static content from a specific folder
swa start ./output-folder

Use an already running framework development server
swa start http://localhost:3000

Use staticwebapp.config.json file in a specific location
swa start http://localhost:3000 --swa-config-location ./app-source

Serve static content and run an API from another folder
swa start ./output-folder --api-location ./api

Use a custom command to run framework development server at startup
swa start http://localhost:3000 --run "npm start"
  `
    );
}

export async function start(startContext: string | undefined, options: SWACLIConfig) {
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

  // start context should never be undefined but we'll check anyway!
  // if the user didn't provide a context, use the current directory
  if (!startContext) {
    startContext = DEFAULT_CONFIG.outputLocation;
  } else {
    if (isHttpUrl(startContext)) {
      useAppDevServer = startContext;
      options.outputLocation = useAppDevServer;
    } else {
      let outputLocationAbsolute = path.resolve(options.appLocation as string, startContext);
      // if folder exists, start the emulator from a specific build folder (outputLocation), relative to appLocation
      if (fs.existsSync(outputLocationAbsolute)) {
        options.outputLocation = outputLocationAbsolute;
      }
      // check for build folder (outputLocation) using the absolute location
      else if (fs.existsSync(startContext)) {
        options.outputLocation = startContext;
      } else {
        logger.error(`The folder "${outputLocationAbsolute}" is not found. Exit.`, true);
        return;
      }
    }
  }

  if (options.apiLocation) {
    // resolves to the absolute path of the apiLocation
    let apiLocationAbsolute = path.resolve(options.appLocation as string, options.apiLocation);

    if (isHttpUrl(apiLocationAbsolute)) {
      useApiDevServer = options.apiLocation;
      options.apiLocation = useApiDevServer;
    }
    // make sure api folder exists
    else if (fs.existsSync(apiLocationAbsolute)) {
      options.apiLocation = apiLocationAbsolute;
    } else {
      logger.info(`Skipping API because folder "${apiLocationAbsolute}" is missing`, "swa");
    }
  }

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
  try {
    userWorkflowConfig = readWorkflowFile({
      userWorkflowConfig,
    });
  } catch (err) {
    logger.warn(``);
    logger.warn(`Error reading workflow configuration:`);
    logger.warn((err as any).message);
    logger.warn(
      `See https://docs.microsoft.com/azure/static-web-apps/build-configuration?tabs=github-actions#build-configuration for more information.`
    );
  }

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
      const nodeMajorVersion = getNodeMajorVersion();
      const targetVersion = detectTargetCoreToolsVersion(nodeMajorVersion);

      if (!funcBinary) {
        // prettier-ignore
        logger.error(
          `\nCould not find or install Azure Functions Core Tools.\n` +
          `Install Azure Functions Core Tools with:\n\n` +
          `  npm i -g azure-functions-core-tools@${targetVersion} --unsafe-perm true\n\n` +
          `See https://aka.ms/functions-core-tools for more information.`,
          true
        );
      } else {
        if (isCoreToolsVersionCompatible(targetVersion, nodeMajorVersion) === false) {
          logger.error(
            `Found Azure Functions Core Tools v${targetVersion} which is incompatible with your current Node.js v${process.versions.node}.`
          );
          logger.error("See https://aka.ms/functions-node-versions for more information.");
          process.exit(1);
        }

        // serve the api if and only if the user provides a folder via the --api-location flag
        if (isApiLocationExistsOnDisk) {
          serveApiCommand = `cd "${userWorkflowConfig.apiLocation}" && ${funcBinary} start --cors "*" --port ${options.apiPort} ${
            options.funcArgs ?? ""
          }`;
        }
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

  // resolve the following config to their absolute paths
  options.swaConfigLocation = options.swaConfigLocation && path.resolve(options.swaConfigLocation);
  options.sslCert = options.sslCert && path.resolve(options.sslCert);
  options.sslKey = options.sslKey && path.resolve(options.sslKey);

  // WARNING: code from above doesn't have access to env vars which are only defined below

  // set env vars for current command
  const envVarsObj: SWACLIEnv = {
    SWA_RUNTIME_CONFIG_LOCATION: options.swaConfigLocation,
    SWA_RUNTIME_WORKFLOW_LOCATION: userWorkflowConfig?.files?.[0] as string,
    SWA_CLI_DEBUG: options.verbose as DebugFilterLevel,
    SWA_CLI_API_PORT: `${apiPort}`,
    SWA_CLI_APP_LOCATION: userWorkflowConfig?.appLocation as string,
    SWA_CLI_OUTPUT_LOCATION: userWorkflowConfig?.outputLocation as string,
    SWA_CLI_API_LOCATION: userWorkflowConfig?.apiLocation as string,
    SWA_CLI_HOST: `${options.host}`,
    SWA_CLI_PORT: `${options.port}`,
    SWA_CLI_APP_SSL: options.ssl ? "true" : "false",
    SWA_CLI_APP_SSL_CERT: options.sslCert,
    SWA_CLI_APP_SSL_KEY: options.sslKey,
    SWA_CLI_STARTUP_COMMAND: startupCommand as string,
    SWA_CLI_VERSION: packageInfo.version,
    SWA_CLI_DEVSERVER_TIMEOUT: `${devserverTimeout}`,
    SWA_CLI_OPEN_BROWSER: options.open ? "true" : "false",
  };

  // merge SWA CLI env variables with process.env
  process.env = {
    ...swaCLIEnv(envVarsObj),
  };

  // INFO: from here, code may access SWA CLI env vars.

  const env = swaCLIEnv();
  const concurrentlyCommands: CommandInfo[] = [
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

  logger.silly(`Starting the SWA emulator with the following configuration:`);
  logger.silly({
    ssl: [options.ssl, options.sslCert, options.sslKey],
    env: envVarsObj,
    commands: {
      swa: concurrentlyCommands.find((c) => c.name === "swa")?.command,
      api: concurrentlyCommands.find((c) => c.name === "api")?.command,
      run: concurrentlyCommands.find((c) => c.name === "run")?.command,
    },
  });

  const { result } = concurrently(concurrentlyCommands, { restartTries: 0 });

  await result.then(
    () => process.exit(),
    () => process.exit()
  );
}
