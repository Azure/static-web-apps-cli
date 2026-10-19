---
sidebar_position: 3
title: "swa build"
---

## Synopsis

```bash
swa build [options] [configName|appLocation]
```

## Description

This command is used to install dependencies and build the project. Here are some common use cases:

- Install dependencies for the front-end app and API and run the build commands for both
- Build only your API if your front-end app doesn't require a build step
- Only install dependencies for the front-end app if your app doesn't require a build step

:::info Note
Installing dependencies is only supported for Node.js projects with a `package.json` file.
For other frameworks, you need to manually install dependencies.
:::

## Options

Here are the options you can use with `swa build`:

- `-a, --app-location <path>`: the folder containing the source code of the front-end application (default: ".")
- `-i, --api-location <path>`: the folder containing the source code of the API application
- `-O, --output-location <path>`: the folder containing the built source of the front-end application. The path is relative to `--app-location` (default: ".")
- `-A, --app-build-command <command>`: the command used to build your app
- `-I, --api-build-command <command>`: the command used to build your api
- `--auto`: automatically detect how to build your app and api (default: false)
- `-h, --help`: display help for command

## Usage

Detect how to build your app run the build commands after installing dependencies:

```bash
swa build --auto
```

Install dependencies for your front-end app:

```bash
swa build --app-location ./client
```

Build your API:

```bash
swa build --api-location ./api --app-build-command "npm run build"
```

Use the configuration named "myApp" in `swa-cli.config.json` to build your app:

```bash
swa build myApp
```

## See Also

- [swa](./swa)
- [swa start](./swa-start)
- [swa deploy](./swa-deploy)
