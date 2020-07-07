## SWA EMU: Azure Static Web Apps Emulator (Alpha Preview)

SWA EMU serves as a local emulator for [Azure Static Web Apps](https://bit.ly/2ZNcakP). It can:

- Auto-build your local APP and API
- Emulate Authentication
- Serve API requests
- Serve static APP assets

## High-level architecture

![swa emulator architecture](./docs/swa-emu-architecture.png)

The SWA emulator CLI is built on top of the following components:

- The Builder: reads the local SWA github workflow flow and builds both the APP and API according to the user's config. And pretty much like SWA, if the user isn't using an API, SWA EMU will skip the API build.
- The reverse proxy: this is the heart of the SWA EMU, it's the piece that forwards all HTTP requests to the appropriate components:
  - `/.auth/**` requests are forwarded to the Auth Emulator server.
  - `/api/**` requests are forwarded to the localhost API function (if available).
  - `/**` all other requests are forwarded to the static assets server (serving the front-end app).
- The Auth Emulator server: this emulate the whole authentication flow.
- The Static content server: this serves the local app static content.

## Disclaimer

SWA EMU is still in alpha preview and not ready yet for prime time. You will encounter issues, so please report them or help us fix them. Your contributions will be very appreciated 🙏

## Quick start

Using `npm` or `yarn`:

- Install the emulator: `npm install -g @manekinekko/swa-emu@alpha`
- Open a SWA app folder: `cd my-awesome-swa-app`
- Start the emulator: `swa`
- Access your SWA app from `http://localhost`

Using `npx`:

- Open a SWA app folder: `cd my-awesome-swa-app`
- Start the emulator: `npx @manekinekko/swa-emu@alpha`
- Access your SWA app from `http://localhost`

## Configuration

SWA EMU binds to these default hosts:

- `http://localhost:4242`: for _emulated_ authentication.
- `http://localhost:7071`: for the API (baked by the Azure Function App)
- `http://localhost:4200`: for app assets (the front-end app)

If you need to override the default values, provide the following options:

| Options        | Description                           | Default                 |
| -------------- | ------------------------------------- | ----------------------- |
| `--api-prefix` | the API URL prefix                    | `api`                   |
| `--auth-uri`   | the Auth URI                          | `http://localhost:4242` |
| `--api-uri`    | the API URI                           | `http://localhost:7071` |
| `--app-uri`    | the app URI                           | `http://localhost:4200` |
| `--host`       | the emulator host address             | `0.0.0.0`               |
| `--port`       | the emulator port value               | `80`                    |
| `--build`      | build the api and app before starting | `false`                 |
| `--debug`      | enable debug logs                     | `false`                 |

## Auth emulation status

| Provider | Local Emulation | Linked OAuth App |
| -------- | --------------- | ---------------- |
| GitHub   | ✅              | ✅               |
| Twitter  | TODO            |                  |
| Google   | TODO            |                  |
| Facebook | TODO            |                  |
| AAD      | TODO            |                  |

## Caveats

- Custom routes are not supported.
- Authorization and roles are not supported.
- The emulator is serving all traffic over HTTP (HTTPS support will be added soon).
- When using GitHub, the OAuth client ID and client secret are provided as-is for dev purposes ONLY. You should create your own OAuth GitHub app!

## Want to help? [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/manekinekko/swa-emu/issues)

Want to file a bug, contribute some code, or improve the documentation? Excellent! Read up on our guidelines for [contributing](https://github.com/manekinekko/swa-emu/blob/master/CONTRIBUTING.md) and then check out one of our issues in the list: [community-help](https://github.com/manekinekko/swa-emu/issues).
