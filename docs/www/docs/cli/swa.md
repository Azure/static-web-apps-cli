---
sidebar_position: 1
---

## Synopsis

```bash
swa [command] [options]
```

## Description

This is the commandline utility for streamlining local development for Azure Static Web Apps. Use it to:

- initialize Azure Static Web Apps project
- build an Azure Static Web Apps project
- login to Azure
- start emulator or bind to dev server
- deploy project to Azure Static Web Apps

## Options

Here are the options you can use with `swa`:

- `-v, --version`: output the version number
- `-V, --verbose [prefix]`: enable verbose output. Values are: silly,info,log,silent (default: "log", preset: "log")
- `-c, --config <path>`: path to swa-cli.config.json file to use (default: "swa-cli.config.json")
- `-cn, --config-name <name>`: name of the configuration to use
- `-g, --print-config`: print all resolved options (default: false)
- `-h, --help`: display help for command

## Commands

Here are the currently supported `swa` commands. Use `swa <command> --help` to learn about options and usage for that particular command.

- [`login`](swa-login): login into Azure
- [`start`](swa-start): start the emulator from a directory or bind to a dev server
- [`deploy`](swa-deploy): deploy the current project to Azure Static Web Apps
- [`init`](swa-init): initialize a new static web app project
- [`build`](swa-build): build your project

## See Also

- [swa init](docs/cli/swa-init)
- [swa build](docs/cli/swa-build)
- [swa start](docs/cli/swa-start)
- [swa login](docs/cli/swa-login)
- [swa deploy](docs/cli/swa-deploy)
- [Configuring CLI](docs/cli/swa-config) - file location, defaults
- [Environment Vars](docs/cli/swa-deploy) - supported settings
