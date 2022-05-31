---
sidebar_position: 10
title: Run in Docker
---

# Run SWA CLI in Docker

[Docker](https://www.docker.com/products/docker-desktop/) enables you to run the [Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli) bundled with a full development environment for Node.js, Python and .NET on your local machine, with minimal setup needed.

First, you need to have Docker installed and running on your host machine. Follow the instructions in the [Docker documentation](https://docs.docker.com/get-docker/) to do that.

Once Docker is running on your machine, open a command prompt and run the following command:

```bash
docker run --rm -p 4280:4280 -it swacli/static-web-apps-cli:latest
```

This command will create a new container on your host machine from the image `swacli/static-web-apps-cli` using the latest version of the CLI, as specified by the `:latest` tag, and run it in interactive mode.

:::info Note
You can also use a specific version of the CLI by using `:<version>` tag instead of `:latest`.
See all available versions [here](https://hub.docker.com/r/swacli/static-web-apps-cli/tags).
:::

Once the image has finished downloading, you will be prompted with a `bash` prompt. You can run the following commands to show the current version of the CLI:

```bash
swa --version
```

You can now invoke any of the CLI commands by typing them in the prompt.

## Connecting your local filesystem to the container

By default, the container is running in an isolated environment, so you can't access the host machine's filesystem. We can however change that by starting the container with the `-v/--volume/` flag.

```bash
docker run --rm -p 4280:4280 -it -v $(pwd):/workspace -w /workspace swacli/static-web-apps-cli:latest
```

The flag `-v $(pwd):/workspace` will mount the current working directory on the host machine to the container's `/workspace` directory. This means that you can now access the host machine's filesystem from the container. Then using the `-w /workspace` flag we are telling the container to change its working directory to the `/workspace` directory, so you'll be able to run the CLI commands from the current folder of your host.
