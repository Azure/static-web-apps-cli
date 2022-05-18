---
sidebar_position: 1
title: "swa"
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

If you don't enter any command and run `swa`, it will act as a macro command shorcut for `swa init`, `swa build`, `swa login` and `swa deploy`. The `swa init` command will only be executed if the `swa-cli.config.json` does not exist in the current folder.

The best way to get started is to use the `swa` command and follow the interactive prompts.

## Options

Here are global options that you can use with any command supported by the `swa` CLI:

- `-v, --version`: output the version number
- `-V, --verbose [prefix]`: enable verbose output. Values are: silly,info,log,silent (default: "log", preset: "log")
- `-c, --config <path>`: path to swa-cli.config.json file to use (default: "swa-cli.config.json")
- `-cn, --config-name <name>`: name of the configuration to use
- `-g, --print-config`: print all resolved options (default: false)
- `-h, --help`: display help for command

## Commands

Here are the currently supported `swa` commands. Use `swa <command> --help` to learn about options and usage for that particular command.

- [`login`](../cli/swa-login): login into Azure
- [`init`](../cli/swa-init): initialize a new static web app project
- [`start`](../cli/swa-start): start the emulator from a directory or bind to a dev server
- [`deploy`](../cli/swa-deploy): deploy the current project to Azure Static Web Apps
- [`build`](../cli/swa-build): build your project

## Usage

Configure, build, login and deploy your project to Azure Static Web Apps in one single command:

```bash
swa
```

That's it!

## See Also

- [swa init](../cli/swa-init)
- [swa build](../cli/swa-build)
- [swa start](../cli/swa-start)
- [swa login](../cli/swa-login)
- [swa deploy](../cli/swa-deploy)
- [Configuring CLI](../cli/swa-config)
- [Environment Vars](../cli/swa-deploy)
