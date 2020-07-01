## SWA EMU: Azure Static Web Apps Emulator

SWA EMU serves as a local emulator for Azure Static Web Apps. It emulates the following features:

- Authentication
- Serving API requests
- Serving static APP assets

## How to use

- Install the emulator: `npm i @manekinekko/swa-emu@alpha`
- Start the emulator: `npm start`
- Access your SWA app from `http://localhost` (default port `80`)

## Getting started

SWA EMU binds to these defaults server ports on localhost:

- `http://localhost:4242`: for authentication.
- `http://localhost:7170`: for the API (baked by Azure Function)
- `http://localhost:4200`: for app assets (the front-end app)

## Customize (optional)

Provide the following environment variables if you need to override the default values:

|Enviroment var| Description| Default|
|--|--|--|
| `SWA_EMU_API_PREFIX`| the API prefix | `api`|
| `SWA_EMU_AUTH_URI`| the Auth uri | `http://localhost:4242`|
| `SWA_EMU_API_URI`| the API uri | `http://localhost:7170`|
| `SWA_EMU_APP_URI`| the app uri | `http://localhost:4200`|
| `SWA_EMU_HOST`| the emulator host address | `0.0.0.0`|
| `SWA_EMU_PORT`| the emulator port | `80`|

## Auth emulation status

| Provider 	| Auth Emulation 	|
|----------	|----------------	|
| GitHub   	| ✅              	|
| Twitter  	| TODO           	|
| Google   	| TODO           	|
| Facebook 	| TODO           	|
| AAD      	| TODO           	|