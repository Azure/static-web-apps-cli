import chalk from "chalk";
import { Command } from "commander";
import concurrently, { CloseEvent } from "concurrently";
import { CommandInfo } from "concurrently/dist/src/command";
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import {
  askNewPort,
  configureOptions,
  createStartupScriptCommand,
  detectTargetCoreToolsVersion,
  getCoreToolsBinary,
  getNodeMajorVersion,
  isAcceptingTcpConnections,
  isCoreToolsVersionCompatible,
  isHttpUrl,
  isUserOption,
  logger,
  matchLoadedConfigName,
  parseServerTimeout,
  parsePort,
  parseUrl,
  readWorkflowFile,
} from "../../core";
import { swaCLIEnv } from "../../core/env";
import { getCertificate } from "../../core/ssl";
let packageInfo = require("../../../package.json");

export default function registerCommand(program: Command) {
  program
    .command("start [configName|outputLocation|appDevserverUrl]")
    .usage("[configName|outputLocation|appDevserverUrl] [options]")
    .description("start the emulator from a directory or bind to a dev server")
    .option("-a, --app-location <path>", "the folder containing the source code of the front-end application", DEFAULT_CONFIG.appLocation)
    .option("-i, --api-location <path>", "the folder containing the source code of the API application", DEFAULT_CONFIG.apiLocation)
    .option("-O, --output-location <path>", "the folder containing the built source of the front-end application", DEFAULT_CONFIG.outputLocation)
    .option("-D, --app-devserver-url <url>", "connect to the app dev server at this URL instead of using output location", DEFAULT_CONFIG.appDevserverUrl)
    .option("-is, --api-devserver-url <url>", "connect to the api server at this URL instead of using output location", DEFAULT_CONFIG.apiDevserverUrl)
    .option<number>("-j, --api-port <apiPort>", "the API server port passed to `func start`", parsePort, DEFAULT_CONFIG.apiPort)
    .option("-q, --host <host>", "the host address to use for the CLI dev server", DEFAULT_CONFIG.host)
    .option<number>("-p, --port <port>", "the port value to use for the CLI dev server", parsePort, DEFAULT_CONFIG.port)

    .option("-s, --ssl", "serve the front-end application and API over HTTPS", DEFAULT_CONFIG.ssl)
    .option("-e, --ssl-cert <sslCertLocation>", "the SSL certificate (.crt) to use when enabling HTTPS", DEFAULT_CONFIG.sslCert)
    .option("-k, --ssl-key <sslKeyLocation>", "the SSL key (.key) to use when enabling HTTPS", DEFAULT_CONFIG.sslKey)
    .option("-r, --run <startupScript>", "run a custom shell command or script file at startup", DEFAULT_CONFIG.run)
    .option<number>(
      "-t, --devserver-timeout <time>",
      "the time to wait (in seconds) when connecting to a front-end application's dev server or api server",
      parseServerTimeout,
      DEFAULT_CONFIG.devserverTimeout
    )
    .option(
      "-w, --swa-config-location <swaConfigLocation>",
      "the directory where the staticwebapp.config.json file is located",
      DEFAULT_CONFIG.swaConfigLocation
    )
    .option("-o, --open", "open the browser to the dev server", DEFAULT_CONFIG.open)
    .option("-f, --func-args <funcArgs>", "pass additional arguments to the func start command")
    .action(async (positionalArg: string | undefined, _options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(positionalArg, command.optsWithGlobals(), command, "start");
      if (positionalArg && !matchLoadedConfigName(positionalArg)) {
        // If it's not the config name, it's either output location or dev server url
        const isUrl = isHttpUrl(positionalArg);
        if (isUrl) {
          if (isUserOption("appDevserverUrl")) {
            logger.error(`swa deploy <appDevserverUrl> cannot be used when --app-devserver-url option is also set.`);
            logger.error(`You either have to use the positional argument or option, not both at the same time.`, true);
          }
          options.appDevserverUrl = positionalArg;
        } else {
          if (isUserOption("outputLocation")) {
            logger.error(`swa deploy <outputLocation> cannot be used when --output-location option is also set.`);
            logger.error(`You either have to use the positional argument or option, not both at the same time.`, true);
          }
          options.outputLocation = positionalArg;
        }
      }

      console.warn(chalk.yellow("***********************************************************************"));
      console.warn(chalk.yellow("* WARNING: This emulator may not match the cloud environment exactly. *"));
      console.warn(chalk.yellow("* Always deploy and test your app in Azure.                           *"));
      console.warn(chalk.yellow("***********************************************************************"));
      console.warn();

      await start(options);
    })
    .addHelpText(
      "after",
      `
Examples:

Serve static content from a specific folder
swa start ./output-folder

Connect to an already running framework development server
swa start http://localhost:3000

Use staticwebapp.config.json file from a specific location
swa start http://localhost:3000 --swa-config-location ./app-source

Serve static content from a folder and run an API from another folder
swa start ./output-folder --api-location ./api

Use a custom command to run framework development server at startup
swa start http://localhost:3000 --run-build "npm start"

Connect both front-end and the API to running development server
swa start http://localhost:3000 --api-location http://localhost:7071
  `
    );
}

export async function start(options: SWACLIConfig) {
  // WARNING:
  // environment variables are populated using values provided by the user to the CLI.
  // Code below doesn't have access to these environment variables which are defined later below.
  // Make sure this code (or code from utils) does't depend on environment variables!

  let {
    appLocation,
    apiLocation,
    outputLocation,
    appDevserverUrl,
    apiDevserverUrl,
    apiPort,
    devserverTimeout,
    ssl,
    sslCert,
    sslKey,
    host,
    port,
    run,
    open,
    funcArgs,
    swaConfigLocation,
    verbose,
  } = options;

  let useApiDevServer: string | undefined | null = undefined;
  let startupCommand: string | undefined | null = undefined;

  let resolvedPortNumber = await isAcceptingTcpConnections({ host, port });
  if (resolvedPortNumber === 0) {
    logger.warn(`Port ${port} is already taken!`);
    resolvedPortNumber = await askNewPort();
  } else {
    logger.silly(`Port ${port} is available. Use it.`);
  }

  // still no luck or user refused to use a random port
  if (resolvedPortNumber === 0) {
    logger.error(`Port ${port} is already in use. Use '--port' to specify a different port.`, true);
  }

  // set the new port number in case we picked a new one (see net.isAcceptingTcpConnections())
  logger.silly(`Resolved port number: ${resolvedPortNumber}`);
  port = resolvedPortNumber;

  // resolve the absolute path to the appLocation
  appLocation = path.resolve(appLocation as string);

  if (appDevserverUrl) {
    logger.silly(`appDevserverUrl provided, we will try connect to dev server at ${outputLocation}`);
    // TODO: properly refactor this after GA to send appDevserverUrl to the server
    outputLocation = appDevserverUrl;
  } else {
    logger.silly(`Resolving outputLocation=${outputLocation} full path...`);
    let resolvedOutputLocation = path.resolve(appLocation as string, outputLocation as string);

    // if folder exists, start the emulator from a specific build folder (outputLocation), relative to appLocation
    if (fs.existsSync(resolvedOutputLocation)) {
      outputLocation = resolvedOutputLocation;
    }
    // check for build folder (outputLocation) using the absolute location
    else if (!fs.existsSync(outputLocation!)) {
      logger.error(`The folder "${resolvedOutputLocation}" is not found. Exit.`, true);
      return;
    }

    logger.silly(`Resolved outputLocation:`);
    logger.silly(`  ${outputLocation}`);
  }

  if (apiLocation) {
    // resolves to the absolute path of the apiLocation
    let resolvedApiLocation = path.resolve(apiLocation);

    if (apiDevserverUrl) {
      // TODO: properly refactor this after GA to send apiDevserverUrl to the server
      useApiDevServer = apiDevserverUrl;
      apiLocation = apiDevserverUrl;
    }
    // make sure api folder exists
    else if (fs.existsSync(resolvedApiLocation)) {
      apiLocation = resolvedApiLocation;
    } else {
      logger.info(`Skipping API because folder "${resolvedApiLocation}" is missing`, "swa");
    }
  }

  let userWorkflowConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation,
    outputLocation,
    apiLocation,
  };

  // mix CLI args with the project's build workflow configuration (if any)
  // use any specific workflow config that the user might provide undef ".github/workflows/"
  // Note: CLI args will take precedence over workflow config
  try {
    // TODO: not sure if we should still do this here, as config/user options should override
    // over any options in the workflow config, but it seems to do the opposite here.
    userWorkflowConfig = readWorkflowFile({
      userWorkflowConfig,
    });

    logger.silly(`User workflow config:`);
    logger.silly(userWorkflowConfig!);
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
    if (apiLocation && userWorkflowConfig?.apiLocation) {
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
          serveApiCommand = `cd "${userWorkflowConfig.apiLocation}" && ${funcBinary} start --cors "*" --port ${apiPort} ${funcArgs ?? ""}`;
        }
      }
    }
  }

  if (ssl) {
    if (sslCert === undefined && sslKey === undefined) {
      logger.warn(`WARNING: Using built-in UNSIGNED certificate. DO NOT USE IN PRODUCTION!`);
      const pemFilepath = await getCertificate({
        selfSigned: true,
        days: 365,
        commonName: host,
        organization: `Azure Static Web Apps CLI ${packageInfo.version}`,
        organizationUnit: "Azure Engineering",
        emailAddress: `secure@microsoft.com`,
      });
      sslCert = pemFilepath;
      sslKey = pemFilepath;
    } else {
      // user provided cert and key, so we'll use them
      sslCert = sslCert && path.resolve(sslCert);
      sslKey = sslKey && path.resolve(sslKey);
    }
  }

  if (run) {
    startupCommand = createStartupScriptCommand(run, options);
  }

  // resolve the following config to their absolute paths
  // note: the server will perform a search starting from this path
  swaConfigLocation = path.resolve(swaConfigLocation || userWorkflowConfig?.appLocation || process.cwd());

  // WARNING: code from above doesn't have access to env vars which are only defined below

  // set env vars for current command
  const envVarsObj: SWACLIEnv = {
    SWA_RUNTIME_CONFIG_LOCATION: swaConfigLocation,
    SWA_RUNTIME_WORKFLOW_LOCATION: userWorkflowConfig?.files?.[0] as string,
    SWA_CLI_DEBUG: verbose as DebugFilterLevel,
    SWA_CLI_API_PORT: `${apiPort}`,
    SWA_CLI_APP_LOCATION: userWorkflowConfig?.appLocation as string,
    SWA_CLI_OUTPUT_LOCATION: userWorkflowConfig?.outputLocation as string,
    SWA_CLI_API_LOCATION: userWorkflowConfig?.apiLocation as string,
    SWA_CLI_HOST: `${host}`,
    SWA_CLI_PORT: `${port}`,
    SWA_CLI_APP_SSL: ssl ? "true" : "false",
    SWA_CLI_APP_SSL_CERT: sslCert,
    SWA_CLI_APP_SSL_KEY: sslKey,
    SWA_CLI_STARTUP_COMMAND: startupCommand as string,
    SWA_CLI_VERSION: packageInfo.version,
    SWA_CLI_SERVER_TIMEOUT: `${devserverTimeout}`,
    SWA_CLI_OPEN_BROWSER: open ? "true" : "false",
  };

  // merge SWA CLI env variables with process.env
  process.env = {
    ...swaCLIEnv(envVarsObj),
    // Prevent react-scripts from opening browser
    BROWSER: "none",
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

  // run an external script, if it's available
  if (startupCommand) {
    let startupPath = userWorkflowConfig?.appLocation;

    concurrentlyCommands.push({ command: `cd "${startupPath}" && ${startupCommand}`, name: "run", env, prefixColor: "gray.dim" });
  }

  logger.silly(`Starting the SWA emulator with the following configuration:`);
  logger.silly({
    ssl: [ssl, sslCert, sslKey],
    env: envVarsObj,
    commands: {
      swa: concurrentlyCommands.find((c) => c.name === "swa")?.command,
      api: concurrentlyCommands.find((c) => c.name === "api")?.command,
      run: concurrentlyCommands.find((c) => c.name === "run")?.command,
    },
  });

  const { result } = concurrently(concurrentlyCommands, { restartTries: 0, killOthers: ["failure", "success"] });

  await result
    .then(
      (errorEvent: CloseEvent[]) => {
        const killedCommand = errorEvent.filter((event) => event.killed).pop();
        const exitCode = killedCommand?.exitCode;
        logger.silly(`SWA emulator exited with code ${exitCode}`);
        process.exit();
      },
      (errorEvent: CloseEvent[]) => {
        const killedCommand = errorEvent.filter((event) => event.killed).pop();
        const commandName = killedCommand?.command.name;
        const exitCode = killedCommand?.exitCode;
        let commandMessage = ``;
        switch (commandName) {
          case "swa":
            commandMessage = `SWA emulator exited with code ${exitCode}`;
            break;
          case "api":
            commandMessage = `API server exited with code ${exitCode}`;
            break;
          case "run":
            commandMessage = `the --run command exited with code ${exitCode}`;
            break;
        }
        logger.error(`SWA emulator stoped because ${commandMessage}.`, true);
      }
    )
    .catch((err) => {
      logger.error(err.message, true);
    });
}
