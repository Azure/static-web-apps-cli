---
sidebar_position: 4
---

# 4. Start the API Server

## 4.1 Azure Functions Core Tools

While not mandatory, your application may choose to take advantage of [serverless API support with Azure Functions](https://docs.microsoft.com/en-us/azure/static-web-apps/apis).
Azure Functions service has its own [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local) CLI to support local development. Read the [API Reference](https://docs.microsoft.com/en-us/azure/azure-functions/functions-core-tools-reference?tabs=v2) to learn about its `func` command and options.

By using the SWA CLI, we can streamline the local development workflow (across Azure Static Web Apps and Azure Functions) even further. The SWA CLI can:

- verify that [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local) is installed in your local development environment.
- download or update the [right version](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local#install-the-azure-functions-core-tools) for you if needed.
- give you the flexibility to have the CLI manage the API server launch if needed.

Let's explore these options.

## 4.2 Start API Server Manually

You might want to run the Azure Functions Core Tools (API server) separately, to take advantage of built-in features like debugging and rich editor support.

To use the SWA emulator services alongside the API server:

1. Start API server first using Azure Functions Core Tools CLI (below) or the [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions). _Note the URL for the local API server, once it is running_.

```bash
func host start
```

2. Start SWA CLI in a separate terminal and use the `--api-location` option to pass it the relevant local API Server URI. _For example:_

```bash
swa start ./my-dist --api-location http://localhost:7071
```

## 4.3 Start API Server Automatically

This assumes you have previously created (and tested) an Azure Functions App project that is now located in an `api` folder in your local development environment.

1. Launch the API server alongside the SWA emulator

```bash
swa start ./my-dist --api-location ./api
```

2. Combine the launch with usage of a running dev server

```bash
swa start http://localhost:3000 --api-location ./api
```
