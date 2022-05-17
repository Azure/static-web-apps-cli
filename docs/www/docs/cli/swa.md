---
sidebar_position: 1
---

## Synopsis

```
Usage: swa [command] [options]
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

```
// output the version number
-v, --version

// enable verbose output.
//   Values are: silly,info,log,silent
//   (default: "log", preset: "log")
--verbose [prefix]

// specify configuration file name
//   default: "swa-cli.config.json"
--config-name <name>

// specify configuration file location (path)
//  default:  current directory
--config <path>

// print all resolved configuration options
--print-config

// display help for command
-h, --help
```

## Commands

Here are the currently supported `swa` commands. Use `swa <command> --help` to learn about options and usage for that particular command.

```
// login to Azure
login [options]

// start the emulator from a directory or bind to a dev server
start [options] [configName|outputLocation|devServerUrl

// deploy the current project to Azure Static Web Apps
deploy [options] [configName|outputLocation]

// initialize a new static web app project
init [options] [configName]

// build your project
build [options] [configName|appLocation]
```

## See Also

- [swa init](docs/cli/swa-init)
- [swa build](docs/cli/swa-build)
- [swa start](docs/cli/swa-start)
- [swa login](docs/cli/swa-login)
- [swa deploy](docs/cli/swa-deploy)
- [Configuring CLI](docs/cli/swa-config) - file location, defaults
- [Environment Vars](docs/cli/swa-deploy) - supported settings
