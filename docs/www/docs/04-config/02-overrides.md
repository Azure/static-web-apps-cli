---
sidebar_position: 2
---

# Configuration Overrides

You can override the StaticWebApp configuration values at runtime by using the Static Web App CLI options as follows:


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
