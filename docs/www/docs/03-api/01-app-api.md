---
sidebar_position: 1
---

# Serve App and API

Azure Static Web Apps provides serverless API endpoints using Azure Functions, allowing your application to scale APIs dynamically with load. Learn more about [API support in Azure Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/apis) and how you can [Add an API](https://docs.microsoft.com/en-us/azure/static-web-apps/add-api?tabs=vanilla-javascript) to your project that gets automatically managed by Azure Static Web Apps.

## 1. Install Core Tools

To work with API functions in your local development environment, you must have [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools) installed. _The SWA CLI will do this for you automatically_.

## 2. Automatic Start

To serve both App and API concurrently, run the CLI and specify the folder that contains the API backend (a valid Azure Functions App project):

```bash
# static content plus API
swa start ./my-dist --api-location ./api-folder
```

If you want to use a front-end dev server, and have a unified command across all three, simply add `--api-location ./api-folder` option to the unified command used earlier. For example:

```bash
# React dev server plus API
swa start http://localhost:3000 --run "npm start" --api-location ./api-folder
```

## 3. Manual Start

When developing your backend locally, sometimes it's useful to run [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local) separately to serve your API. This allows you to use built-in features like debugging and rich editor support.

To use the CLI with your local API backend dev server, follow these two steps:

1. Debug directly in Visual Studio Code - or start your API using Azure Functions Core Tools as follows:
```bash
func host start
``` 
2. In a separate terminal, run the SWA CLI with the `--api-location` flag and the URI of the local API server:
```bash
swa start ./my-dist --api-location http://localhost:7071
```