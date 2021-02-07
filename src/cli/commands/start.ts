import fs from "fs";
import path from "path";
import shell from "shelljs";
import builder from "../../builder";
import { createRuntimeHost } from "../../runtimeHost";
import { getBin, isHttpUrl, isPortAvailable, readConfigFile, validateDevServerConfig } from "../../utils";
import { DEFAULT_CONFIG } from "../config";

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

  const authPortAvailable = await isPortAvailable({ port: authPort });
  if (authPortAvailable === false) {
    console.info(`INFO: Port "${authPortAvailable}" is already in use. Choose a different port (1024 to 49151).`);
    process.exit(0);
  }

  // parse the APP URI port or use default
  let appPort = (program.appPort || DEFAULT_CONFIG.appPort) as number;

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

  // set env vars for current command
  const envVarsObj = {
    DEBUG: program.verbose ? "*" : "",
    SWA_CLI_AUTH_PORT: `${program.authPort}`,
    SWA_CLI_API_PORT: `${program.apiPort}`,
    SWA_CLI_APP_PORT: `${program.appPort}`,
    SWA_CLI_APP_LOCATION: configFile?.appLocation as string,
    SWA_CLI_APP_ARTIFACT_LOCATION: configFile?.appArtifactLocation as string,
    SWA_CLI_API_LOCATION: configFile?.apiLocation as string,
    SWA_CLI_HOST: program.host,
    SWA_CLI_PORT: `${program.port}`,
  };

  // handle the APP location config
  let serveStaticContent = undefined;
  if (useAppDevServer) {
    serveStaticContent = `echo 'using app dev server at ${useAppDevServer}'`;
  } else {
    const { command: hostCommand, args: hostArgs } = createRuntimeHost({
      appPort: appPort,
      proxyHost: program.host as string,
      proxyPort: program.port as number,
      appLocation: configFile?.appLocation,
      appArtifactLocation: configFile?.appArtifactLocation,
    });
    serveStaticContent = `${hostCommand} ${hostArgs.join(" ")}`;
  }

  // handle the API location config
  let serveApiContent = undefined;
  if (useApiDevServer) {
    serveApiContent = `echo 'using api dev server at ${useApiDevServer}'`;
  } else {
    // serve the api if and only if the user provide the --api-location flag
    if (program.apiLocation && configFile?.apiLocation) {
      serveApiContent = `([ -d '${configFile?.apiLocation}' ] && (cd ${configFile?.apiLocation}; func start --cors * --port ${program.apiPort})) || echo 'No API found. Skipping.'`;
    }
  }

  const concurrentlyBin = getBin("concurrently");

  const startCommand = [
    // run concurrent commands
    `${concurrentlyBin}`,
    `--restart-tries 3`,
    `--names " swa","auth"," app"," api"`, // 4 characters each
    `-c 'bgYellow.bold,bgMagenta.bold,bgCyan.bold,bgGreen.bold'`,

    // start the reverse proxy
    `"node ../proxy.js"`,

    // emulate auth
    `"node ../auth/server.js --host=${program.host} --port=${authPort}"`,

    // serve the app
    `"${serveStaticContent}"`,

    // serve the api, if it's available
    serveApiContent && `"${serveApiContent}"`,

    `--color=always`,
  ];

  if (process.env.DEBUG) {
    console.log({ env: envVarsObj });
    console.log({ startCommand });
  }

  if (program.build) {
    // run the app/api builds
    builder({
      config: configFile as GithubActionSWAConfig,
    });
  }
  // run concurrent commands
  shell.exec(
    startCommand.join(" "),
    {
      // set the cwd to the installation folder
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, ...envVarsObj },
    },
    (_code, _stdout, stderr) => {
      if (stderr.length) {
        console.error(stderr);
      }
    }
  );
}
