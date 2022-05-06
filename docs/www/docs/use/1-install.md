---
sidebar_position: 1
---

# 1. Install the SWA CLI

You can install the Static Web Apps CLI using either [`npm`](https://docs.npmjs.com/cli/v6/commands/npm-install) or [`yarn`](https://classic.yarnpkg.com/lang/en/docs/cli/install/).

## Install with npm

**See: **[@azure/static-web-apps-cli](https://www.npmjs.com/package/@azure/static-web-apps-cli) .

1. To install this globally, use:

```bash
npm install -g @azure/static-web-apps-cli
```

2. The recommended approach is to install this locally, as a devDependency using:

```bash
npm install -D @azure/static-web-apps-cli
```

## Install with yarn

**See: **[@azure/static-web-apps-cli](hhttps://yarnpkg.com/package/@azure/static-web-apps-cli).

1. To install this globally, use:

```bash
yarn add global @azure/static-web-apps-cli
```

2. The recommended approach is to install this locally, as a devDependency, using:

```bash
yarn add -D @azure/static-web-apps-cli
```

## Validate the install

Installing the package should make the **swa** command available on your development machine. To validate, try using the command with an appropriate option.

For instance, check the installed version.

```bash
$ swa --version
0.8.3
```

## Run using npx

The [npx](https://docs.npmjs.com/cli/v7/commands/npx) command (aka "npm exec") lets you run an arbitrary command from a local or remote npm package. If the command was not installed globally on the device, this installs it for you in a central cache - making it a useful option if you want to use different versions of the same command on the local device.

We can now run any Static Web Apps CLI commands directly using npx - for example: check the version as follows:

```bash
$ npx @azure/static-web-apps-cli --version
```

Or use this command to start the emulator on your local device:

```bash
$ npx @azure/static-web-apps-cli start
```
