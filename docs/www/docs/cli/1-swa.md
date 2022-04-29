---
sidebar_position: 1
---

# `swa`

You can use the following options to override default values for any `swa` command:

| Option                  | Description                                                        | Default                 | Example                                   |
| ----------------------- | ------------------------------------------------------------------ | ----------------------- | ----------------------------------------- |
| `--verbose`             | Enable verbose output. Values are: `silly, info, log, silent`      | `log`                   | `--verbose=silly`                         |
| `--config`              | Path to [`swa-cli.config.json`](#swa-cli.config.json) file to use  | `./swa-cli.config.json` | `--config=./path/to/swa-cli.config.json`  |
| `--print-config`        | Print all resolved options                                         | `false`                 | `--print-config` or `--print-config=true` |
| `--swa-config-location` | The directory where the `staticwebapp.config.json` file is located | `./`                    | `--swa-config-location=./app`             |

 |