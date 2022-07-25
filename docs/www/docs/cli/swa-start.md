---
sidebar_position: 4
title: "swa start"
---

## Synopsis

```bash
swa start [configName|outputLocation|appDevserverUrl] [options]
```

## Description

This command is used to start the Azure Static Web Apps emulator from a directory or bind to a dev server.

### Serve from a folder

By default, the CLI starts and serves any the static content from the current working directory `./`:

```bash
swa start
```

However, you can override this behavior. If the artifact folder of your static app is under a different folder (e.g. `./my-dist`), then run the CLI and provide that folder:

```bash
swa start ./my-dist
```

### Serve from a dev server

When developing your front-end app locally, it's often useful to use the dev server that comes with your front-end framework's CLI to serve your app content. Using the framework CLI allows you to use built-in features like the livereload and HMR (hot module replacement).

To use SWA CLI with your local dev server, follow these two steps:

1. Start your local dev server (as usual). For example, if you are using Angular: `ng serve` (or `npm start`)
1. In a separate terminal, run `swa start` with the URI provided by the dev server, in the following format:

```bash
swa start http://<APP_DEV_SERVER_HOST>:<APP_DEV_SERVER_PORT>
```

Here is a list of the default ports used by some popular dev servers:

| Tool                                                                               | Port | Command                           |
| ---------------------------------------------------------------------------------- | ---- | --------------------------------- |
| [Angular](https://angular.io/cli)                                                  | 4200 | `swa start http://localhost:4200` |
| [Blazor WebAssembly](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor)     | 5000 | `swa start http://localhost:5000` |
| [Gatsby](https://www.gatsbyjs.com/docs/gatsby-cli/)                                | 8000 | `swa start http://localhost:8000` |
| [Hugo](https://gohugo.io/commands/hugo_server/)                                    | 1313 | `swa start http://localhost:1313` |
| [Next.js](https://nextjs.org/)                                                     | 3000 | `swa start http://localhost:3000` |
| [React (Create React App)](https://reactjs.org/docs/create-a-new-react-app.html)   | 3000 | `swa start http://localhost:3000` |
| [Svelte (sirv-cli)](https://github.com/lukeed/sirv/tree/master/packages/sirv-cli/) | 5000 | `swa start http://localhost:5000` |
| [Vue](https://github.com/vuejs/create-vue)                                                      | 3000 | `swa start http://localhost:3000` |

Instead of starting a dev server separately, you can provide the startup command to the CLI.

```bash
# npm start script (React)
swa start http://localhost:3000 --run "npm start"

# dotnet watch (Blazor)
swa start http://localhost:5000 --run "dotnet watch run"

# Jekyll
swa start http://localhost:4000 --run "jekyll serve"

# custom script
swa start http://localhost:4200 --run "./startup.sh"
```

Then access the application with the emulated services from `http://localhost:4280`

### Serve both the front-end app and API

If your project includes API functions, the CLI will check if the Azure Functions Core Tools are installed and available. If not, the CLI will download and install the right version of the Azure Functions Core Tools.

#### Start the API server automatically

Run the CLI and provide the folder that contains the API backend (a valid Azure Functions App project):

```bash
# static content plus an API
swa start ./my-dist --api-location ./api

# front-end dev server plus an API
swa start http://localhost:3000 --api-location ./api
```

#### Start API server manually

When developing your backend locally, sometimes it's useful to run Azure Functions Core Tools separately to serve your API. This allows you to use built-in features like debugging and rich editor support.

To use the CLI with your local API backend dev server, follow these two steps:

1. Start your API using Azure Functions Core Tools: `func host start` or start debugging in VS Code.
2. In a separate terminal, run the SWA CLI with the `--api-location` flag and the URI of the local API server, in the following format:

```bash
swa start ./my-dist --api-location http://localhost:7071
```

## Options

Here are the options you can use with `swa start`:

- `-a, --app-location <path>`: the folder containing the source code of the front-end application (default: ".")
- `-i, --api-location <path>`: the folder containing the source code of the API application
- `-O, --output-location <path>`: the folder containing the built source of the front-end application. The path is relative to `--app-location` (default: ".")
- `-D, --app-devserver-url <url>`: connect to the app dev server at this URL instead of using output location
- `-is, --api-devserver-url <url>`: connect to the api server at this URL instead of using output location
- `-j, --api-port <apiPort>`: the API server port passed to `func start` (default: 7071)
- `-q, --host <host>`: the host address to use for the CLI dev server (default: "localhost")
- `-p, --port <port>`: the port value to use for the CLI dev server (default: 4280)
- `-s, --ssl`: serve the front-end application and API over HTTPS (default: false)
- `-e, --ssl-cert <sslCertLocation>`: the SSL certificate (.crt) to use when enabling HTTPS
- `-k, --ssl-key <sslKeyLocation>`: the SSL key (.key) to use when enabling HTTPS
- `-r, --run <startupScript>`: run a custom shell command or script file at startup
- `-t, --devserver-timeout <time>`: the time to wait (in seconds) when connecting to a front-end application's dev server or api server (default: 60)
- `-w, --swa-config-location <swaConfigLocation>`: the directory where the staticwebapp.config.json file is located
- `-o, --open`: open the browser to the dev server (default: false)
- `-f, --func-args <funcArgs>`: pass additional arguments to the func start command
- `-h, --help`: display help for command

## Usage

Serve static content from a specific folder

```bash
swa start ./output-folder
```

Connect to an already running framework development server

```bash
swa start http://localhost:3000
```

Use staticwebapp.config.json file from a specific location

```bash
swa start http://localhost:3000 --swa-config-location ./app-source
```

Serve static content from a folder and run an API from another folder

```bash
swa start ./output-folder --api-location ./api
```

Use a custom command to run framework development server at startup

```bash
swa start http://localhost:3000 --run-build "npm start"
```

Connect both front-end and the API to running development server

```bash
swa start http://localhost:3000 --api-location http://localhost:7071
```

## See Also

- [swa](./swa)
- [swa login](./swa-login)
