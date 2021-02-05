import { spawn } from "child_process";
import { CommanderStatic } from "commander";
import fs from "fs";
import path from "path";
import shell from "shelljs";
import builder from "../../builder";
import { Dashboard } from "../../dashboard";
import { createRuntimeHost } from "../../runtimeHost";
import { getBin, isHttpUrl, isPortAvailable, parseUrl, readConfigFile, validateDevServerConfig } from "../../utils";
import { DEFAULT_CONFIG } from "../config";

export async function start(startContext: string, program: CommanderStatic) {
  let useAppDevServer = null;
  let useApiDevServer = null;

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
  let { port: authUriPort } = parseUrl(program.authUri);
  authUriPort = authUriPort || (DEFAULT_CONFIG.authPort as number);

  const authPortAvailable = await isPortAvailable({ port: authUriPort });
  if (authPortAvailable === false) {
    console.info(`INFO: Port "${authPortAvailable}" is already in use. Choose a different port (1024 to 49151).`);
    process.exit(0);
  }

  // parse the APP URI port or use default
  let { port: appUriPort } = parseUrl(program.appUri);
  appUriPort = appUriPort || (DEFAULT_CONFIG.appPort as number);

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
    SWA_EMU_AUTH_URI: program.authUri,
    SWA_EMU_API_URI: useApiDevServer || program.apiUri,
    SWA_EMU_APP_URI: useAppDevServer || program.appUri,
    SWA_EMU_APP_LOCATION: configFile?.appLocation as string,
    SWA_EMU_APP_ARTIFACT_LOCATION: configFile?.appArtifactLocation as string,
    SWA_EMU_API_LOCATION: configFile?.apiLocation as string,
    SWA_EMU_HOST: program.host,
    SWA_EMU_PORT: program.port,
  };

  // handle the APP location config
  let serveStaticContent = undefined;
  if (useAppDevServer) {
    serveStaticContent = `echo 'using app dev server at ${useAppDevServer}'`;
  } else {
    const { command: hostCommand, args: hostArgs } = createRuntimeHost({
      appPort: appUriPort,
      proxyHost: program.host,
      proxyPort: program.port,
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
      serveApiContent = `([ -d '${configFile?.apiLocation}' ] && (cd ${configFile?.apiLocation}; func start --cors *)) || echo 'No API found. Skipping.'`;
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
    `"node ../auth/server.js --host=localhost --port=${authUriPort}"`,

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

  if (program.ui) {
    // print the dashboard UI
    const dashboard = new Dashboard();

    const spawnx = (command: string, args: string[]) =>
      spawn(`${command}`, args, {
        shell: true,
        env: { ...process.env, ...envVarsObj },
        cwd: path.resolve(__dirname, ".."),
      });

    // start hosting
    // FIXME: https://github.com/Azure/static-web-apps-cli/issues/40
    // const hosting = spawnx(hostCommand, hostArgs);
    // dashboard.stream("hosting", hosting);

    // start functions
    const functions = spawnx(`[ -d '${apiLocation}' ] && (cd ${apiLocation}; func start --cors *) || echo 'No API found. Skipping.'`, []);
    dashboard.stream("functions", functions);

    // start auth
    const auth = spawnx(`(cd ./dist/auth/; func start --cors=* --port=${authUriPort})`, []);
    dashboard.stream("auth", auth);

    // start proxy
    const status = spawnx(`node`, [`./dist/proxy`]);
    dashboard.stream("status", status);

    process.on("exit", () => {
      process.exit(process.pid);
    });
  } else {
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
}
