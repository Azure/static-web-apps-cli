---
sidebar_position: 3
---

# `swa start`

If you need to override the default values for the `swa start` subcommand, you can provide the following options:

| Option                | Description                                                                                                    | Default   | Example                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| `--app-location`      | The folder containing the source code of the front-end application                                             | `./`      | `--app-location="./app"`                                           |
| `--api-location`      | The folder containing the source code of the API application. This could also be an URL to a `func` dev server | `./api`   | `--api-location="./api"` or `--api-location=http://localhost:8083` |
| `--api-port`          | The API server port passed to `func start`                                                                     | `7071`    | `--api-port=8082`                                                  |
| `--host`              | The host address to use for the CLI dev server                                                                 | `0.0.0.0` | `--host=192.168.68.80`                                             |
| `--port`              | The port value to use for the CLI dev server                                                                   | `4280`    | `--port=8080`                                                      |
| `--ssl`               | Serve the front-end application and API over HTTPS                                                             | `false`   | `--ssl` or `--ssl=true`                                            |
| `--ssl-cert`          | The SSL certificate (.crt) to use when enabling HTTPS                                                          |           | `--ssl-cert="/home/user/ssl/example.crt"`                          |
| `--ssl-key`           | The SSL key (.key) to use when enabling HTTPS                                                                  |           | `--ssl-key="/home/user/ssl/example.key"`                           |
| `--run`               | Run a custon shell command or file at startup                                                                  |           | `--run="cd app & npm start"`                                       |
| `--devserver-timeout` | The time (in milliseconds) to wait when connecting to a front-end application's dev server                     | `30000`   | `--devserver-timeout=60000`                                        |
| `--func-args`         | Pass additional arguments to the `func start` command                                                          |           | `--func-args="--javascript"`                                       |
| `--open`              | Automatically open the CLI dev server in the default browser.                                                  | `false`   | `--open` or `--open=true`                                          |
