import concurrently from "concurrently";
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import builder from "../../core/builder";
import { isAcceptingTcpConnections, isHttpUrl, parseUrl, readWorkflowFile, validateDevServerConfig } from "../../core/utils";

export async function start(startContext: string, program: SWACLIConfig) {
  let useAppDevServer = undefined;
  let useApiDevServer = undefined;

  if (isHttpUrl(startContext)) {
    useAppDevServer = await validateDevServerConfig(startContext);
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

  let apiPort = (program.apiPort || DEFAULT_CONFIG.apiPort) as number;
  let userConfig: Partial<GithubActionWorkflow> | undefined = {
    appLocation,
    appArtifactLocation,
    apiLocation,
  };

  if (useAppDevServer) {
    // if we are using an app dev server, don't apply workflow files
  } else {
    // mix CLI args with the project's build workflow configuration (if any)
    // use any specific workflow config that the user might provide undef ".github/workflows/"
    // Note: CLI args will take precedence over workflow config
    userConfig = readWorkflowFile({
      userConfig,
    });
  }

  const isApiLocationExistsOnDisk = fs.existsSync(userConfig?.apiLocation!);
  // parse the API URI port

  // handle the API location config
  let serveApiCommand = "echo No API found. Skipping";

  if (useApiDevServer) {
    serveApiCommand = `echo 'using API dev server at ${useApiDevServer}'`;

    // get the API port from the dev server
    apiPort = parseUrl(useApiDevServer)?.port;
  } else {
    if (program.apiLocation && userConfig?.apiLocation) {
      // @todo check if the func binary is globally available
      const funcBinary = "func";
      // serve the api if and only if the user provides a folder via the --api-location flag
      if (isApiLocationExistsOnDisk) {
        serveApiCommand = `cd ${userConfig.apiLocation} && ${funcBinary} start --cors * --port ${program.apiPort}`;
      }
    }
  }

  // set env vars for current command
  const envVarsObj = {
    DEBUG: program.verbose ? "*" : "",
    SWA_CLI_API_PORT: `${apiPort}`,
    SWA_CLI_APP_LOCATION: userConfig?.appLocation as string,
    SWA_CLI_APP_ARTIFACT_LOCATION: useAppDevServer || (userConfig?.appArtifactLocation as string),
    SWA_CLI_API_LOCATION: useApiDevServer || (userConfig?.apiLocation as string),
    SWA_CLI_HOST: program.host,
    SWA_CLI_PORT: `${program.port}`,
    SWA_WORKFLOW_FILES: userConfig?.files?.join(","),
  };

  const concurrentlyEnv = { ...process.env, ...envVarsObj };
  const concurrentlyCommands = [
    // start the reverse proxy
    { command: `node ${path.join(__dirname, "..", "..", "proxy", "server.js")}`, name: "swa", env: concurrentlyEnv, prefixColor: "bgMagenta.bold" },
  ];

  if (isApiLocationExistsOnDisk) {
    concurrentlyCommands.push(
      // serve the api, if it's available
      { command: serveApiCommand, name: "api", env: concurrentlyEnv, prefixColor: "bgGreen.bold" }
    );
  }

  if (program.verbose) {
    console.log({ env: envVarsObj });
    console.log({ concurrentlyCommands });
  }

  if (program.build) {
    // run the app/api builds
    await builder({
      config: userConfig as GithubActionWorkflow,
    });
  }

  await concurrently(concurrentlyCommands, {
    restartTries: 0,
    prefix: "name",
  }).then(
    () => process.exit(),
    () => process.exit()
  );
}
