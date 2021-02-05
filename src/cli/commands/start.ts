import { spawn } from "child_process";
import { CommanderStatic } from "commander";
import fs from "fs";
import path from "path";
import shell from "shelljs";
import builder from "../../builder";
import { Dashboard } from "../../dashboard";
import { createRuntimeHost } from "../../runtimeHost";
import { getBin, GithubActionSWAConfig, isAcceptingTcpConnections, isHttpUrl, isPortAvailable, parseUrl, readConfigFile } from "../../utils";
import { DEFAULT_CONFIG } from "../config";

export async function start(startContext: string, program: CommanderStatic) {
  if (isHttpUrl(startContext)) {
    // start the emulator and proxy app to the provided uri
    let { hostname, port } = parseUrl(startContext);

    // make sure host and port are available
    try {
      const appListening = await isAcceptingTcpConnections({ port, host: hostname });
      if (appListening === false) {
        console.info(`INFO: Could not connect to "${startContext}". Is the server up and running?`);
        process.exit(0);
      } else {
        program.useApp = startContext;
      }
    } catch (err) {
      if (err.message.includes("EACCES")) {
        console.info(`INFO: Port "${port}" cannot be used. You might need elevated or admin privileges. Or, use a valid port: 1024 to 49151.`);
      } else {
        console.error(err.message);
      }
      process.exit(0);
    }
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

  // make sure api folder exists
  if (program.apiLocation) {
    if (fs.existsSync(program.apiLocation) === false) {
      console.info(`INFO: The api folder "${program.apiLocation}" is not found.`);
      process.exit(0);
    }
  }

  // parse the Auth URI port or use default
  let { port: authUriPort } = parseUrl(program.authUri);
  authUriPort = authUriPort || DEFAULT_CONFIG.authPort;

  const authPortAvailable = await isPortAvailable({ port: authUriPort });
  if (authPortAvailable === false) {
    console.info(`INFO: Port "${authPortAvailable}" is already in use. Choose a different port (1024 to 49151).`);
    process.exit(0);
  }

  // parse the APP URI port or use default
  let { port: appUriPort } = parseUrl(program.appUri);
  appUriPort = appUriPort || DEFAULT_CONFIG.appPort;

  // get the app and api artifact locations
  let [appLocation, appArtifactLocation, apiLocation] = [
    program.appLocation as string,
    program.appArtifactLocation as string,
    program.apiLocation as string,
  ];

  // retrieve the project's build configuration
  // use any specific config that the user might provide
  const configFile = readConfigFile({
    overrideConfig: {
      appLocation,
      appArtifactLocation,
      apiLocation,
    },
  });

  const envVarsObj = {
    // set env vars for current command
    StaticWebAppsAuthCookie: "123",
    StaticWebAppsAuthContextCookie: "abc",
    AppServiceAuthSession: "1a2b3c",
    DEBUG: program.debug ? "*" : "",

    // use the default dev token
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    SWA_EMU_AUTH_URI: program.authUri,
    SWA_EMU_API_URI: program.useApi || program.apiUri,
    SWA_EMU_API_PREFIX: program.apiPrefix,
    SWA_EMU_APP_URI: program.useApp || program.appUri,
    SWA_EMU_APP_LOCATION: configFile?.appLocation as string,
    SWA_EMU_APP_ARTIFACT_LOCATION: configFile?.appArtifactLocation as string,
    SWA_EMU_API_LOCATION: configFile?.apiLocation as string,
    SWA_EMU_HOST: program.host,
    SWA_EMU_PORT: program.port,
  };

  // handle the APP location config
  let serveStaticContent = undefined;
  if (program.useApp) {
    serveStaticContent = `echo 'using app dev server at ${program.useApp}'`;
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
  if (program.useApi) {
    serveApiContent = `echo 'using api dev server at ${program.useApi}'`;
  } else {
    // serve the api if and only if the user provide the --api-location flag
    if (program.apiLocation && configFile?.apiLocation) {
      serveApiContent = `([ -d '${configFile?.apiLocation}' ] && (cd ${configFile?.apiLocation}; func start --cors *)) || echo 'No API found. Skipping.'`;
    }
  }

  // provide binaries
  const concurrentlyBin = getBin("concurrently");

  const startCommand = [
    // run concurrent commands
    concurrentlyBin,
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
