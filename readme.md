## SWA EMU: Azure Static Web Apps Emulator (Alpha Preview)

SWA EMU serves as a local emulator for Azure Static Web Apps. It can:
- Auto-build your local APP and API
- Emulate Authentication
- Serves API requests
- Serves static APP assets

## Disclaimer

SWA EMU is still is alpha preview, which means that you might encounter issues (and you will!). Your contribution would be highly appreciated 🙏

## Quick start

- Install the emulator: `npm install -g @manekinekko/swa-emu@alpha` (or `npx @manekinekko/swa-emu@alpha`)
- Open a SWA app folder: `cd my-awesome-swa-app`
- Start the emulator: `swa --build`
- Access your SWA app from `http://localhost`

## Configuration

SWA EMU binds to these default hosts:

- `http://localhost:4242`: for _emulated_ authentication.
- `http://localhost:7071`: for the API (baked by Azure Function)
- `http://localhost:4200`: for app assets (the front-end app)

Provide the following options if you need to override the default values:

| Options            | Description               | Default                 |
| ------------------ | ------------------------- | ----------------------- |
| `swa --api-prefix` | the API prefix            | `api`                   |
| `swa --auth-uri`   | the Auth uri              | `http://localhost:4242` |
| `swa --api-uri`    | the API uri               | `http://localhost:7071` |
| `swa --app-uri`    | the app uri               | `http://localhost:4200` |
| `swa --host`       | the emulator host address | `0.0.0.0`               |
| `swa --port`       | the emulator port value   | `80`                    |
| `swa --build`      | build the api and app     | `false`                 |
| `swa --debug`      | enable debug logs         | `false`                 |

## Auth emulation status

| Provider | Emulation | OAuth app |
| -------- | --------- | --------- |
| GitHub   | ✅        | ✅        |
| Twitter  | TODO      |           |
| Google   | TODO      |           |
| Facebook | TODO      |           |
| AAD      | TODO      |           |

## Caveats

- Custom routes are not supported.
- Authorization and roles are not supported.
- Emulator is serving all traffic over HTTP. HTTPS traffic is not yet supported.
- GitHub OAuth tokens are provided as-is for dev purposes. You should create your own OAuth GitHub app!

## Want to help? [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/manekinekko/swa-emu/issues)

Want to file a bug, contribute some code, or improve the documentation? Excellent! Read up on our guidelines for [contributing](https://github.com/manekinekko/swa-emu/blob/master/CONTRIBUTING.md) and then check out one of our issues in the hotlist: [community-help](https://github.com/manekinekko/swa-emu/issues).
