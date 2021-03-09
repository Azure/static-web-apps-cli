import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import builder from "../../core/builder";
import { isAcceptingTcpConnections, isHttpUrl, parseUrl, readConfigFile, validateDevServerConfig } from "../../core/utils";

export async function start(startContext: string, program: CLIConfig) {
  let useApiDevServer = undefined;

  if (isHttpUrl(startContext)) {
    program.appArtifactLocation = await validateDevServerConfig(startContext);
  } else {
    // start the emulator from a specific artifact folder, if folder exists
    if (await isAcceptingTcpConnections({ host: program.host, port: program.port! })) {
      console.info(`INFO: Port ${program.port} is already used. Choose a different port.`);
      process.exit(0);
    }

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

  // parse the API URI port
  let apiPort = (program.apiPort || DEFAULT_CONFIG.apiPort) as number;
  const isApiLocationExistsOnDisk = fs.existsSync(configFile?.apiLocation!);

  // handle the API location config
  let serveApiContent = "echo No API found. Skipping";
  if (useApiDevServer) {
    serveApiContent = `echo 'using API dev server at ${useApiDevServer}'`;
    const { port } = parseUrl(useApiDevServer);
    apiPort = port;
  } else {
    if (program.apiLocation && configFile?.apiLocation) {
      const funcBinary = "func";
      // serve the api if and only if the user provides a folder via the --api-location flag
      if (isApiLocationExistsOnDisk) {
        serveApiContent = `cd ${configFile.apiLocation} && ${funcBinary} start --cors * --port ${program.apiPort}`;
      }
    }
  }

  // set env vars for current command
  const envVarsObj = {
    DEBUG: program.verbose ? "*" : "",
    SWA_CLI_API_PORT: `${apiPort}`,
    SWA_CLI_APP_LOCATION: configFile?.appLocation as string,
    SWA_CLI_APP_ARTIFACT_LOCATION: configFile?.appArtifactLocation as string,
    SWA_CLI_API_LOCATION: configFile?.apiLocation as string,
    SWA_CLI_HOST: program.host,
    SWA_CLI_PORT: `${program.port}`,
  };

  const concurrentlyEnv = { ...process.env, ...envVarsObj };
  const concurrentlyCommands = [
    // start the reverse proxy
    { command: `node ${path.join(__dirname, "..", "..", "proxy", "server.js")}`, name: "swa", env: concurrentlyEnv, prefixColor: "bgMagenta.bold" },
  ];

  if (isApiLocationExistsOnDisk) {
    concurrentlyCommands.push(
      // serve the api, if it's available
      { command: serveApiContent, name: "api", env: concurrentlyEnv, prefixColor: "bgGreen.bold" }
    );
  }

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
  }).then(
    () => process.exit(),
    () => process.exit()
  );
}
