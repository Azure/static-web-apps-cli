---
sidebar_position: 1
---

# 1. Install the SWA CLI

You can install the Static Web Apps CLI using [`npm`](https://docs.npmjs.com/cli/v6/commands/npm-install), [`yarn`](https://classic.yarnpkg.com/lang/en/docs/cli/install/) or [`pnpm`](https://pnpm.io/cli/install).

## Installing the CLI

**See: **[@azure/static-web-apps-cli](https://www.npmjs.com/package/@azure/static-web-apps-cli) .

1. To install this globally, use:

```bash
npm install -g @azure/static-web-apps-cli
```

:::info Note
You can also install the SWA CLI inside a project (instead of globally) as a development dependency using:

```bash
npm install -D @azure/static-web-apps-cli
```

:::

## Validate the install

Installing the package will make the **`swa`** command available on your development machine. To validate your install, you can check the installed version with:

```bash
swa --version
# Should print out the version number
```

## Basic usage

The best way to get started is to run the `swa` command alone and follow the interactive prompts.

```bash
swa
```

It will generate a configuration for you, then build your project and ask if you want to deploy it to Azure.

See [swa](../cli/swa) for more details.

## Extended usage

Here are the currently supported `swa` commands. Use `swa <command> --help` to learn about options and usage for that particular command.

- [`login`](../cli/swa-login): login into Azure
- [`init`](../cli/swa-init): initialize a new static web app project
- [`start`](../cli/swa-start): start the emulator from a directory or bind to a dev server
- [`deploy`](../cli/swa-deploy): deploy the current project to Azure Static Web Apps
- [`build`](../cli/swa-build): build your project

## Run using npx

The [npx](https://docs.npmjs.com/cli/v7/commands/npx) command (aka "npm exec") lets you run an arbitrary command from a local or remote npm package. If the command was not installed globally on the device, this installs it for you in a central cache - making it a useful option if you want to use different versions of the same command on the local device.

You can run any Static Web Apps CLI commands directly using npx. For example:

```bash
npx @azure/static-web-apps-cli --version
```

Or use this command to start the emulator:

```bash
npx @azure/static-web-apps-cli start
```
