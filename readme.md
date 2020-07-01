## SWA EMU: Azure Static Web Apps Emulator

SWA EMU serves as a local emulator for Azure Static Web Apps. It emulates the following features:

- Support local authentication
- Serving API requests
- Serving static APP assets

## Quick start

- Install the emulator: `npm install -g @manekinekko/swa-emu@alpha`
- Start the emulator: `swa`
- Access your SWA app from `http://localhost`

## Configuration

SWA EMU binds to these defaults server URIs:

- `http://localhost:4242`: for authentication.
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

## Auth emulation status

| Provider | Auth Emulation |
| -------- | -------------- |
| GitHub   | ✅             |
| Twitter  | TODO           |
| Google   | TODO           |
| Facebook | TODO           |
| AAD      | TODO           |

## Caveats

- Custom routes are not supported.
- Authorization is not supported.
- Emulator is serving all traffic over HTTP.
