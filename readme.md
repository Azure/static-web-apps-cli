<p align="center">
    <h2 align="center">Azure Static Web Apps CLI</h2>
</p>
<p align="center">
    <img align="center" src="docs/swa-emu-icon.png" width="300">
</p>

Introducing Static Web Apps CLI, the Azure Static Web Apps CLI that serves as a local development tool for [Azure Static Web Apps](https://bit.ly/2ZNcakP). It can:

- Auto-build the local static app and API
- Emulate Authentication
- Serve API requests
- Serve static static app assets

## High-level architecture

![swa cli architecture](./docs/swa-emu-architecture.png)

The Static Web Apps CLI is built on top of the following components:

- The Reverse Proxy: this is the heart of the Static Web Apps CLI, it's the piece that forwards all HTTP requests to the appropriate components:
  - `/.auth/**` requests are forwarded to the Auth emulator server.
  - `/api/**` requests are forwarded to the localhost API function (if available).
  - `/**` all other requests are forwarded to the static assets server (serving the front-end app).
- The Auth emulator server: emulates the whole authentication flow.
- The Static content server: serves the local app static content.
- The Serverless API server (served by the Azure Function App).

Before Static Web Apps CLI bootstraps, it also can read (using the `--build` options) the local SWA github workflow file (created by [Azure Static Web Apps](https://bit.ly/2ZNcakP)) and builds both the static app and the api according to the user's config. And pretty much like SWA, if the user isn't using an API, Static Web Apps CLI will skip the API build.

## Disclaimer

Static Web Apps CLI is still in developer preview and not yet ready for prime time. You will encounter issues, so please report them or help us fix them. Your contributions will be very appreciated 🙏

## Quick start

Using `npm` or `yarn`:

- Install the cli: `npm install -g @azure/static-web-apps-cli@latest`
- Open a SWA app folder at the root (outside any /api or /app folders): `cd my-awesome-swa-app`
- Start the emulator: `swa start`
- Access your SWA app from `http://localhost`

Using `npx`:

- Open a SWA app folder at the root (outside any /api or /app folders): `cd my-awesome-swa-app`
- Start the emulator: `npx @manekinekko/swa-emu@latest start`
- Access your SWA app from `http://localhost`

### Start the emulator

#### Serve from a folder

By default, SWA EMU will start and serve the static app from the current working directory `./`:

```bash
swa
```

However, you can override this behavior. If the artifact folder of your static app is under a different folder (e.g. `./my-dist`), then run the SWA EMU and provide that folder:

```bash
swa ./my-dist
```

> Note that by default the SWA EMU will not serve the api.

#### Serve from a local app dev server

When developing locally on your static app, it might be useful to use your local application dev server, that comes with your application CLI, to serve your app content and benefit from the built-in features like the livereload and HMR (hot module reload).

In order to use Static Web Apps CLI with your local dev server, follow these two steps:

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

#### Serve with a local API dev server

When developing locally on your back-end application, it might be useful to use your local API dev server, to serve your API content and benefit from the built-in features like debugging. In order to use SWA EMU with your local API dev server, follow these two steps:

1. Start your local API dev server (as usual). For example: `func start host`.
1. Run `swa` with the `--use-api` flag of the URI provided by the API dev server, in the following format:

```bash
swa start ./my-dist --use-api=http://<api-dev-server-host>:<api-dev-server-port>
```

## Configuration

Static Web Apps CLI binds to these default hosts:

- `http://localhost:4242`: for _emulated_ authentication.
- `http://localhost:7071`: for the API (baked by the Azure Function App)
- `http://localhost:4200`: for app assets (the front-end app)

If you need to override the default values, provide the following options:

| Options        | Description                           | Default                 | Example                                |
| -------------- | ------------------------------------- | ----------------------- | -------------------------------------- |
| `--api-prefix` | the API URL prefix                    | `api`                   | `swa --api=prefix=my-api-route`        |
| `--auth-uri`   | the Auth URI                          | `http://localhost:4242` | `swa --auth-uri=http://localhost:8083` |
| `--api-uri`    | the API URI                           | `http://localhost:7071` | `swa --api-uri=http://localhost:8082`  |
| `--app-uri`    | the app URI                           | `http://localhost:4200` | `swa --app-uri=http://localhost:8081`  |
| `--use-app`    | use the app dev server                | `null`                  | `swa --use-app=http://localhost:8080`  |
| `--use-api`    | use the api dev server                | `null`                  | `swa --use-api=http://localhost:3000`  |
| `--host`       | the emulator host address             | `0.0.0.0`               | `swa --host=192.168.68.80`             |
| `--port`       | the emulator port value               | `4280`                  | `swa --port=8080`                      |
| `--build`      | build the api and app before starting | `false`                 | `swa --build`                          |
| `--verbose`    | enable debug logs                     | `false`                 | `swa --verbose`                        |
| `--ui`         | enable dashboard UI                   | `false`                 | `swa --ui`                             |

## Local Emulation

The cli supports local authentication flow and mocks the following providers:

| Provider | [Endpoint](https://docs.microsoft.com/azure/static-web-apps/authentication-authorization?WT.mc_id=javascript-0000-wachegha#login) | Local Emulation |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| GitHub   | `.auth/login/github`                                                                                                              | ✅               |
| Twitter  | `.auth/login/twitter`                                                                                                             | ✅               |
| Google   | `.auth/login/google`                                                                                                              | ✅               |
| Facebook | `.auth/login/facbook`                                                                                                             | ✅               |
| AAD      | `.auth/login/aad`                                                                                                                 | ✅               |

When requesting the `.auth/me` endpoint, a `clientPrincipal` containing the mock information configured by the user will be returned by the cli. Here is an example:

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

## Authentication emulation flow

The Authentication flow is illustrated in the following sequence diagram (or [open in a new tab](https://bit.ly/swa-auth-flow)):

![SWA Auth flow diagram](docs/swa-auth-flow.png)

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

