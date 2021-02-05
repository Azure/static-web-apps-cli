<p align="center">
    <h2 align="center">Static Web Apps CLI</h2>
</p>
<p align="center">
    <img align="center" src="docs/swa-emu-icon.png" width="300">
</p>

The Static Web Apps CLI, also known as SWA CLI, serves as a local development tool for [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps). It can:

- Build the local static app and API backend
- Emulate Authentication and Authorization
- Serve API requests, or use the Azure Function dev server
- Serve static static app assets, or use your app dev server

## High-level architecture

![swa cli architecture](./docs/swa-emu-architecture.png)

The SWA CLI is built on top of the following components:

- The Reverse Proxy: this is the heart of the SWA CLI, it's the piece that forwards all HTTP requests to the appropriate components:
  - `/.auth/**` requests are forwarded to the Auth emulator server.
  - `/api/**` requests are forwarded to the localhost API function (if available).
  - `/**` all other requests are forwarded to the static assets server (serving the front-end app).
- The Auth emulator server: emulates the whole authentication flow.
- The Static content server: serves the local app static content.
- The Serverless API server (served by the Azure Function App).

Before SWA CLI bootstraps, it can also read (when using the `--build` options) the local SWA GitHub workflow file (created by [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps)) and builds both the static app and the API backend according based on the config. If the user isn't using an API backend, SWA CLI will skip the API backend build.

## Disclaimer

SWA CLI is still in developer preview and not yet ready for prime time. You will encounter issues, so please report them or help us fix them. Your contributions will be very appreciated 🙏

## Quick start

Using `npm` or `yarn`:

- Install the cli: `npm install -g @azure/static-web-apps-cli`
- Open a SWA app folder at the root (outside any /api or /app folders): `cd my-awesome-swa-app`
- Start the emulator: `swa start`
- Access your SWA app from `http://localhost:4280`

> Note: The cli can also be installed locally as a devDependency: `npm install -D @azure/static-web-apps-cli`

Using `npx`:

- Open a SWA app folder at the root (outside any /api or /app folders): `cd my-awesome-swa-app`
- Start the emulator: `npx @azure/static-web-apps-cli start`
- Access your SWA app from `http://localhost:4280`

### Start the emulator

#### Serve from a folder

By default, CLI will start and serve any the static content from the current working directory `./`:

```bash
swa start
```

However, you can override this behavior. If the artifact folder of your static app is under a different folder (e.g. `./my-dist`), then run the CLI and provide that folder:

```bash
swa start ./my-dist
```

> Note: By default the CLI will not serve the api.

#### Serve both the static app and api

If you are using an API, then run the CLI and provide the folder that contains the API project:

```bash
swa start ./my-dist --app ./api-folder
```

#### Serve from a local app dev server

When developing locally on your static app, it might be useful to use your local application dev server, that comes with your application CLI, to serve your app content and benefit from the built-in features like the livereload and HMR (hot module reload).

In order to use SWA CLI with your local dev server, follow these two steps:

1. Start your local dev server (as usual). For example: `ng serve`
1. Run `swa start` with the URI provided by the dev server, in the following format:

```bash
swa start http://<app-dev-server-host>:<app-dev-server-port>
```

Here is a list of the default ports used by popular dev servers:

| Tool                                                                               | Port | Command                               |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| [Angular](https://angular.io/cli)                                                  | 4200 | `swa --use-app=http://localhost:4200` |
| [Vue](https://cli.vuejs.org/)                                                      | 8080 | `swa --use-app=http://localhost:8080` |
| [Vite](https://github.com/vitejs/vite/)                                            | 3000 | `swa --use-app=http://localhost:3000` |
| [Create React App](https://reactjs.org/docs/create-a-new-react-app.html)           | 3000 | `swa --use-app=http://localhost:3000` |
| [Webpack Dev Server](https://github.com/webpack/webpack-dev-server)                | 8080 | `swa --use-app=http://localhost:8080` |
| [Parcel](https://parceljs.org/cli.html)                                            | 1234 | `swa --use-app=http://localhost:1234` |
| [Stencil](https://stenciljs.com/docs/dev-server)                                   | 3333 | `swa --use-app=http://localhost:3333` |
| [Hugo](https://gohugo.io/commands/hugo_server/)                                    | 1313 | `swa --use-app=http://localhost:1313` |
| [Elm (live server)](https://github.com/wking-io/elm-live/)                         | 8000 | `swa --use-app=http://localhost:8000` |
| [Ionic](https://ionicframework.com/docs/cli/commands/serve/)                       | 8100 | `swa --use-app=http://localhost:8100` |
| [Svelte (sirv-cli)](https://github.com/lukeed/sirv/tree/master/packages/sirv-cli/) | 5000 | `swa --use-app=http://localhost:5000` |
| [Sapper](https://sapper.svelte.dev/)                                               | 3000 | `swa --use-app=http://localhost:3000` |
| [Scully.io](https://scully.io/)                                                    | 1668 | `swa --use-app=http://localhost:1668` |
| [Gatsby](https://www.gatsbyjs.com/docs/gatsby-cli/)                                | 8000 | `swa --use-app=http://localhost:8000` |
| [Nuxt.js](https://nuxtjs.org/)                                                     | 3000 | `swa --use-app=http://localhost:3000` |
| [Next.js](https://nextjs.org/)                                                     | 3000 | `swa --use-app=http://localhost:3000` |

#### Serve with a local API backend dev server

When developing locally on your back-end application, it might be useful to use your local API backend dev server, to serve your API backend content and benefit from the built-in features like debugging. In order to use CLI with your local API backend dev server, follow these two steps:

1. Start your local API backend dev server (as usual). For example: `func start host`.
1. Run `swa` with the `--use-api` flag of the URI provided by the API backend dev server, in the following format:

```bash
swa start ./my-dist --use-api=http://<api-dev-server-host>:<api-dev-server-port>
```

## Configuration

SWA CLI binds to these default hosts:

- `http://localhost:4242`: for the _emulated_ authentication.
- `http://localhost:7071`: for the API backend (baked by the Azure Function App)
- `http://localhost:4200`: for the static app (the front-end app)

If you need to override the default values, provide the following options:

| Options      | Description                           | Default                 | Example                            |
| ------------ | ------------------------------------- | ----------------------- | ---------------------------------- |
| `--api`      | set the API folder or URI             | `./api`                 | `--api=http://localhost:8083`      |
| `--auth-uri` | set the Auth URI                      | `http://localhost:4242` | `--auth-uri=http://localhost:8083` |
| `--api-uri`  | set the API URI                       | `http://localhost:7071` | `--api-uri=http://localhost:8082`  |
| `--app-uri`  | set the app URI                       | `http://localhost:4200` | `--app-uri=http://localhost:8081`  |
| `--host`     | set the emulator host address         | `0.0.0.0`               | `--host=192.168.68.80`             |
| `--port`     | set the emulator port value           | `4280`                  | `--port=8080`                      |
| `--build`    | build the api and app before starting | `false`                 | `--build`                          |
| `--verbose`  | enable verbose logs                   | `false`                 | `--verbose`                        |

## Local Authentication emulation

When requesting `./auth/login/<provider>`, you will access a local Authentication UI allowing you to set fake user information.

When requesting the `.auth/me` endpoint, a `clientPrincipal` containing the fake information will be returned by the Authentication API. Here is an example:

```json
{
  "clientPrincipal": {
    "identityProvider": "twitter",
    "userId": "<user-uuid>",
    "userDetails": "manekinekko",
    "userRoles": ["anonymous", "authenticated"]
  }
}
```

> NOTE: user roles and ACL are not fully supported (see [#7](https://github.com/azure/static-web-apps-cli/issues/7)).

## Caveats

- Custom routes are not yet fully supported (see [#6](https://github.com/azure/static-web-apps-cli/issues/6))
- Authorization and roles are not fully supported (see [#7](https://github.com/azure/static-web-apps-cli/issues/7)).
- The cli is serving all traffic over HTTP (HTTPS support will be added soon) (see [#4](https://github.com/azure/static-web-apps-cli/issues/4)).

## Troubleshooting

### Port 4242 is unavailable

This means that there is already an instance of Azure Functions Core Tools (assigned to the Auth emulator) that is running and bound to the default port `4242`.

To fix it, either:

- close the other running instance, and run the cli again.
- run the cli using a different port: `--auth-uri=http://localhost:4243`
- force close the other instance by killing its processes: `lsof -t -i tcp:4242 | xargs kill`

### Error: listen EADDRINUSE: address already in use 0.0.0.0:4280

This error indicates that another app is running and bound to the default port of the emulator: `4280`.

To fix it, either:

- close the other running instance, and run the emulator again.
- run the emulator using a different port: `--port=8081`
- force close the other instance by killing its processes: `lsof -t -i tcp:4280 | xargs kill`

## Want to help? [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/azure/static-web-apps-cli/issues)

Want to file a bug, contribute some code, or improve the documentation? Excellent! Read up on our guidelines for [contributing](https://github.com/azure/static-web-apps-cli/blob/master/CONTRIBUTING.md) and then check out one of our issues in the list: [community-help](https://github.com/azure/static-web-apps-cli/issues).
