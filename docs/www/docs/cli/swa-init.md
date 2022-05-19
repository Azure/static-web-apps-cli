---
sidebar_position: 2
title: "swa init"
---

## Synopsis

```bash
swa init [options] [configName]
```

## Description

This command is used to configure your project to use with the Static Web Apps CLI.
It will ask for a configuration name, detect your project settings and the frameworks used and create a `swa-cli.config.json` file in the current directory.
You can use this file to configure any options for the CLI.

Note that you can run `swa init` multiple times to create different configurations for your project. This is useful for example if you're working on a monorepo and want to configure different projects.

The generated configuration file will be used in every command you run with the Static Web Apps CLI.
If you have multiple named configurations, you can use the positional argument or `--config-name` option to specify which one you want to use, see usage examples below.

### Example configuration

Here's an example `swa-cli.config.json` configuration file:

```json
{
  "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  "configurations": {
    "myApp": {
      "appLocation": ".",
      "apiLocation": "api",
      "outputLocation": "dist",
      "appBuildCommand": "npm run build",
      "apiBuildCommand": "npm run build --if-present",
      "run": "npm run dev",
      "appDevserverUrl": "http://localhost:8080"
    }
  }
}
```

## Options

- `-y, --yes`: answer yes to all prompts (disable interactive mode) (default: false)
- `-h, --help`: display help for command

## Usage

Create a new configuration interactively

```bash
swa init
```

Create a new configuration using default values for all options (aka "I feel lucky")

```bash
swa init --yes
```

Run any command using the configuration named "myApp" in `swa-cli.config.json`

```bash
swa <command> --config-name myApp
# or
swa <command> myApp
```

## See Also

- [swa](swa)
- [swa build](swa-build)
- [swa start](swa-start)
