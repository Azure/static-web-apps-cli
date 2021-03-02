import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import builder from "../../core/builder";
import { createRuntimeHost } from "../../core/runtimeHost";
import { isHttpUrl, isAcceptingTcpConnections, parseUrl, readConfigFile, validateDevServerConfig } from "../../core/utils";
import { DEFAULT_CONFIG } from "../../config";

export async function start(startContext: string, program: CLIConfig) {
  let useAppDevServer = undefined;
  let useApiDevServer = undefined;

  if (isHttpUrl(startContext)) {
    useAppDevServer = await validateDevServerConfig(startContext);
  } else {
    // start the emulator from a specific artifact folder, if folder exists
    if (fs.existsSync(startContext)) {
      program.appArtifactLocation = startContext;
    } else {
      console.info(
        `INFO: The dist folder "${startContext}" is not found. Make sure that this folder exists or use the --build option to pre-build the app.`
      );
      process.exit(0);
    }
  }

  if (program.apiLocation) {
    if (isHttpUrl(program.apiLocation)) {
      useApiDevServer = await validateDevServerConfig(program.apiLocation);
    }
    // make sure api folder exists
    else if (fs.existsSync(program.apiLocation) === false) {
      console.info(`INFO: Skipping API because folder "${program.apiLocation}" is missing.`);
    }
  }

  // parse the Auth URI port or use default
  const authPort = (program.authPort || DEFAULT_CONFIG.authPort) as number;

  const appListening = await isAcceptingTcpConnections({ port: authPort });

  if (appListening === true) {
    console.info(`INFO: It looks like another instance of the CLI is already running (reason: auth server).`);
    process.exit(0);
  }

  // get the app and api artifact locations
  let [appLocation, appArtifactLocation, apiLocation] = [
    program.appLocation as string,
    program.appArtifactLocation as string,
    program.apiLocation as string,
  ];

  // retrieve the project's build configuration
  // use any specific config that the user might provide
  const configFile = readConfigFile({
    userConfig: {
      appLocation,
      appArtifactLocation,
      apiLocation,
    },
  });

  // parse the APP URI port
  let appPort = (program.appPort || DEFAULT_CONFIG.appPort) as number;

  // handle the APP location config
  let serveStaticContent = undefined;
  if (useAppDevServer) {
    serveStaticContent = `echo 'using app dev server at ${useAppDevServer}'`;
    const { port } = parseUrl(useAppDevServer);
    appPort = port;
  } else {
    if (
      (await isAcceptingTcpConnections({
        port: appPort,
      })) === true
    ) {
      const randomPort = Math.floor(Math.random() * 49150) + 1024;
      // @Todo: don't block and just define a random port for static server
      // program.appPort = randomPort;

      console.info(`INFO: Cannot start static server at "http://${program.host}:${appPort}". Port is already in use.`);
      console.info(`INFO: Choose a different port (1024 to 49151).`);
      console.info(`Hint: Try swa start ${startContext} --app-port=${randomPort}`);
      process.exit(0);
    }

    const { command: hostCommand, args: hostArgs } = createRuntimeHost({
      appPort: appPort,
      proxyHost: program.host as string,
      proxyPort: program.port as number,
      appLocation: configFile?.appLocation,
      appArtifactLocation: configFile?.appArtifactLocation,
    });
    serveStaticContent = `${hostCommand} ${hostArgs.join(" ")}`;
  }

  // parse the API URI port
  let apiPort = (program.apiPort || DEFAULT_CONFIG.apiPort) as number;

  // handle the API location config
  let serveApiContent = "echo No API found. Skipping";
  if (useApiDevServer) {
    serveApiContent = `echo 'using api dev server at ${useApiDevServer}'`;
    const { port } = parseUrl(useApiDevServer);
    apiPort = port;
  } else {
    if (program.apiLocation && configFile?.apiLocation) {
      const funcBinary = "func";
      // serve the api if and only if the user provides a folder via the --api-location flag
      if (fs.existsSync(configFile.apiLocation)) {
        serveApiContent = `cd ${configFile.apiLocation} && ${funcBinary} start --cors * --port ${program.apiPort}`;
      }
    }
  }

  // set env vars for current command
  const envVarsObj = {
    DEBUG: program.verbose ? "*" : "",
    SWA_CLI_AUTH_PORT: `${program.authPort}`,
    SWA_CLI_API_PORT: `${apiPort}`,
    SWA_CLI_APP_PORT: `${appPort}`,
    SWA_CLI_APP_LOCATION: configFile?.appLocation as string,
    SWA_CLI_APP_ARTIFACT_LOCATION: configFile?.appArtifactLocation as string,
    SWA_CLI_API_LOCATION: configFile?.apiLocation as string,
    SWA_CLI_HOST: program.host,
    SWA_CLI_PORT: `${program.port}`,
  };

  const concurrentlyEnv = { ...process.env, ...envVarsObj };
  const concurrentlyCommands = [
    // start the reverse proxy
    { command: `node ${path.join(__dirname, "..", "..", "proxy", "server.js")}`, name: " swa", env: concurrentlyEnv, prefixColor: "bgYellow.bold" },

    // emulate auth
    {
      command: `node ${path.join(__dirname, "..", "..", "auth", "server.js")} --host=${program.host} --port=${authPort}`,
      name: "auth",
      env: concurrentlyEnv,
      prefixColor: "bgMagenta.bold",
    },

    // serve the app
    { command: serveStaticContent, name: " app", env: concurrentlyEnv, prefixColor: "bgCyan.bold" },

    // serve the api, if it's available
    { command: serveApiContent, name: " api", env: concurrentlyEnv, prefixColor: "bgGreen.bold" },
  ];

  if (process.env.DEBUG) {
    console.log({ env: envVarsObj });
    console.log({ concurrentlyCommands });
  }

  if (program.build) {
    // run the app/api builds
    await builder({
      config: configFile as GithubActionSWAConfig,
    });
  }

  await concurrently(concurrentlyCommands, {
    restartTries: 1,
    prefix: "name",
  });
}
