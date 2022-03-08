<p align="center">
    <h2 align="center">Azure Static Web Apps CLI (preview) <img src="https://github.com/azure/static-web-apps-cli/workflows/CI/badge.svg" height="15"> </h2>
</p>
<p align="center">
    <img align="center" src="docs/swa-emu-icon.png" width="300">
</p>

The Static Web Apps CLI, also known as SWA CLI, serves as a local development tool for [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps). It can:

- Serve static app assets, or proxy to your app dev server
- Serve API requests, or proxy to APIs running in Azure Functions Core Tools
- Emulate authentication and authorization
- Emulate Static Web Apps configuration, including routing

**Static Web Apps CLI is in preview.** If you have suggestions or you encounter issues, please report them or help us fix them. Your contributions are very much appreciated. 🙏

The CLI emulates commonly used capabilities of the Azure Static Web Apps cloud service. **Some differences are expected. Always deploy and test your apps in Azure to confirm behavior.**

## Quickstart

Using `npm` or `yarn`:

- Install the cli
  ```bash
  npm install -g @azure/static-web-apps-cli
  ```
- Open a SWA app folder at the root (outside any /api or /app folders):
  ```bash
  cd my-awesome-swa-app
  ```
- Start the emulator:
  ```bash
  swa start ./
  ```
- Access your SWA app from `http://localhost:4280`

> Note: The cli can also be installed locally as a devDependency: `npm install -D @azure/static-web-apps-cli`

Using `npx`:

- Open a SWA app folder at the root (outside any /api or /app folders): `cd my-awesome-swa-app`
- Start the emulator: `npx @azure/static-web-apps-cli start`
- Access your SWA app from `http://localhost:4280`

## Start the emulator

### Serve from a folder

By default, CLI starts and serves any the static content from the current working directory `./`:

```bash
swa start
```

However, you can override this behavior. If the artifact folder of your static app is under a different folder (e.g. `./my-dist`), then run the CLI and provide that folder:

```bash
swa start ./my-dist
```

### Serve from a dev server

When developing your frontend app locally, it's often useful to use the dev server that comes with your frontend framework's CLI to serve your app content. Using the framework CLI allows you to use built-in features like the livereload and HMR (hot module replacement).

To use SWA CLI with your local dev server, follow these two steps:

1. Start your local dev server (as usual). For example, if you are using Angular: `ng serve`
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
| [Vue](https://cli.vuejs.org/)                                                      | 8080 | `swa start http://localhost:8080` |

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

Go to 4280 (`http://localhost:4280`) to access the application with the emulated services.

### Serve both the static app and API

If your project includes API functions, install [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools):

```bash
npm install -g azure-functions-core-tools@3 --unsafe-perm true
```

#### Start API server automatically

Run the CLI and provide the folder that contains the API backend (a valid Azure Functions App project):

```bash
# static content plus API
swa start ./my-dist --api-location ./api-folder

# frontend dev server plus API
swa start http://localhost:3000 --api-location ./api-folder
```

#### Start API server manually

When developing your backend locally, sometimes it's useful to run Azure Functions Core Tools separately to serve your API. This allows you to use built-in features like debugging and rich editor support.

To use the CLI with your local API backend dev server, follow these two steps:

1. Start your API using Azure Functions Core Tools: `func host start` or start debugging in VS Code.
2. In a separate terminal, run the SWA CLI with the `--api-location` flag and the URI of the local API server, in the following format:
   ```bash
   swa start ./my-dist --api-location http://localhost:7071
   ```

## Use a configuration file (staticwebapp.config.json)

Azure Static Web Apps can be configured with an optional `staticwebapp.config.json` file. For more information, see [Configure Static Web Apps documentation](https://docs.microsoft.com/azure/static-web-apps/configuration).

If you are serving static files from a folder, the CLI will search this folder for `staticwebapp.config.json`.

```bash
# ./my-dist is searched for staticwebapp.config.json
swa start ./my-dist
```

If you are using a frontend dev server, the CLI will search the current directory for `staticwebapp.config.json`.

```bash
# current working directory is searched for staticwebapp.config.json
swa start http://localhost:3000
```

To control where the CLI searches for `staticwebapp.config.json`, use `--swa-config-location`.

```bash
# static files
swa start ./my-dist --swa-config-location ./my-app-source

# frontend dev server
swa start http://localhost:3000 --swa-config-location ./my-app-source
```

## Configuration

If you need to override the default values, provide the following options:

| Options                 | Description                                             | Default                 | Example                                                            |
| ----------------------- | ------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------ |
| `--app-location`        | set location for the static app source code             | `./`                    | `--app-location="./my-project"`                                    |
| `--api-location`        | set the API folder or dev server                        |                         | `--api-location="./api"` or `--api-location=http://localhost:8083` |
| `--swa-config-location` | set the directory of the staticwebapp.config.json file. |                         | `--swa-config-location=./my-project-folder`                        |
| `--api-port`            | set the API server port                                 | `7071`                  | `--api-port=8082`                                                  |
| `--host`                | set the emulator host address                           | `0.0.0.0`               | `--host=192.168.68.80`                                             |
| `--port`                | set the emulator port value                             | `4280`                  | `--port=8080`                                                      |
| `--ssl`                 | serving the app and API over HTTPS (default: false)     | `false`                 | `--ssl` or `--ssl=true`                                            |
| `--ssl-cert`            | SSL certificate to use for serving HTTPS                |                         | `--ssl-cert="/home/user/ssl/example.crt"`                          |
| `--ssl-key`             | SSL key to use for serving HTTPS                        |                         | `--ssl-key="/home/user/ssl/example.key"`                           |
| `--run`                 | Run a command at startup                                |                         | `--run="cd app & npm start"`                                       |
| `--devserver-timeout`   | The time to wait(in ms) for the dev server to start     | 30000                   | `--devserver-timeout=60000`                                        |
| `--func-args`           | Additional arguments to pass to `func start`            |                         | `--func-args="--javascript"`                                       |
| `--config`              | Path to swa-cli.config.json file to use.                | `./swa-cli.config.json` | `--config ./config/swa-cli.config.json`                            |
| `--print-config`        | Print all resolved options. Useful for debugging.       |                         | `--print-config` or `--print-config=true`                          |
| `--open`                | Automatically open the SWA dev server in the default browser. | `false`           | `--open` or `--open=true` |

## swa-cli.config.json file

The CLI can also load options from a `swa-cli.config.json` file.

```json
{
  "configurations": {
    "app": {
      "context": "http://localhost:3000",
      "apiLocation": "api",
      "run": "npm run start",
      "swaConfigLocation": "./my-app-source"
    }
  }
}
```

If only a single configuration is present in the `swa-cli.config.json` file, running `swa start` will use it by default. If options are loaded from a config file, no options passed in via command line will be respected. For example `swa start app --ssl=true`. The `--ssl=true` option will not be picked up by the CLI.

### Example

We can simplify these commands by putting the options into a config file.

```bash
# static configuration
swa start ./my-dist --swa-config-location ./my-app-source

# devserver configuration
swa start http://localhost:3000 --swa-config-location ./my-app-source
```

```json
{
  "configurations": {
    "static": {
      "context": "./my-dist",
      "swaConfigLocation": "./my-app-source"
    },
    "devserver": {
      "context": "http://localhost:3000",
      "swaConfigLocation": "./my-app-source"
    }
  }
}
```

These configurations can be run with `swa start static` and `swa start devserver`.

### Validation

You can validate your `swa-cli.config.json` with a JSON Schema like so:

```json
{
  "$schema": "https://raw.githubusercontent.com/Azure/static-web-apps-cli/main/schema/swa-cli.config.schema.json",
  "configurations": {
    ...
  }
}
```

## Local authentication & authorization emulation

The CLI allows you to mock and read authentication and authorization credentials.

### Mocking credentials

When requesting the Static Web Apps login endpoints (`http://localhost:4280/.auth/login/<PROVIDER_NAME>`), you have access to a local authentication UI. This interface is served locally from the emulator and allows you to set fake user information for the current user from the provider supplied.

### Reading credentials

The frontend application can request the `http://localhost:4280/.auth/me` endpoint and a `clientPrincipal` containing the fake information will be returned by the authentication API.

Here is an example:

```json
{
  "clientPrincipal": {
    "identityProvider": "twitter",
    "userId": "<USER-UUID>",
    "userDetails": "<USER_NAME>",
    "userRoles": ["anonymous", "authenticated"],
    "claims": [{
      typ: "name",
      val: "Azure Static Web Apps",
    }]
  }
}
```

The API functions can access user information using the `x-ms-client-principal` header.

See [Accessing user information](https://docs.microsoft.com/azure/static-web-apps/user-information) documentation for more details.

## High-level architecture

![swa cli architecture](./docs/swa-cli-architecture.png)

The SWA CLI is built on top of the following components:

- A **Reverse Proxy** is the heart of the SWA CLI; it's the piece that forwards all HTTP requests to the appropriate components:
  - `/.auth/**` requests are forwarded to the Auth emulator server.
  - `/api/**` requests are forwarded to the localhost API function (if available).
  - `/**` all other requests are forwarded to the static assets server (serving the front-end app).
- The **Auth emulator server** emulates the whole authentication flow.
- The **Static content server** serves the local app static content.
- The **Serverless API server** is served by Azure Functions Core Tools.

## Want to help? [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/azure/static-web-apps-cli/issues)

Want to file a bug, contribute some code, or improve the documentation? Excellent! Read up on our guidelines for [contributing](https://github.com/azure/static-web-apps-cli/blob/master/CONTRIBUTING.md) and then check out one of our issues in the list: [community-help](https://github.com/azure/static-web-apps-cli/issues).
