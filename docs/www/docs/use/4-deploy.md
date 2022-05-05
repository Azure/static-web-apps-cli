---
sidebar_position: 5
---

# 5. Deploy SWA to Azure

The CLI can also be used to deploy an app to Azure Static Web Apps using the command: `swa deploy`. Here are some common use cases:

1. Deploy a front-end app without an API
2. Deploy a front-end app with an API
3. Deploy a Blazor app

A **Deployment Token** is required in order to make a deployment! Read the steps below to learn how to access a deployment token.

## 5.1 Deployment token

The CLI supports Deployment token. This is usually useful when deploying from a CI/CD environment. You can get a deployment token either from:

- The [Azure portal](https://portal.azure.com/): **Home → Static Web App → Your Instance → Overview → Manage deployment token**

- If you are using the [Azure CLI](https://aka.ms/azcli), you can get the deployment token of your project using the following command:

```bash
az staticwebapp secrets list --name <application-name> --query "properties.apiKey"
```

- If you are using the [Azure Static Web Apps CLI (this project)](https://aka.ms/swa/cli-local-development), you can get the deployment token of your project using the following command:

```bash
swa deploy --print-token
```

You can then use that value with the `--deployment-token <token>` (e.g. from a CI/CD environment), or you can create an environment variable called `SWA_CLI_DEPLOYMENT_TOKEN` and set it to the deployment token. Read the next section for more details.

**IMPORTANT:** Don't store the deployment token in a public repository. It should be kept secret!

## 5.2 Deploy a front-end app without an API

You can deploy a front-end application (without an API) to Azure Static Web Apps by running the following steps:

1. If your front-end application requires a build step, run the build step (e.g. `npm run build`) or refer to your application build instructions.

**Option 1:** From build folder you would like to deploy, run the deploy command:

```bash
cd build/
swa deploy
```

> Note: the "build" folder must contain the static content of your app to be deployed!

**Option 2:** You can also deploy a specific folder:

1. If your front-end application requires a build step, run the build step (e.g. `npm run build`) or refer to your application build instructions.

2. Deploy your app:

```bash
swa deploy ./my-dist
```

## 5.3 Deploy a front-end app with an API

To deploy both the front-end app and an API to Azure Static Web Apps, use the following steps:

1. If your front-end application requires a build step, run the build step (e.g. `npm run build`) or refer to your application build instructions.

2. Make sure the[ API language runtime version](https://docs.microsoft.com/en-us/azure/static-web-apps/configuration#platform) in the `staticwebapp.config.json` file is set correctly, for example:

```json
{
  "platform": {
    "apiRuntime": "node:16"
  }
}
```

3. Deploy your app:

```bash
swa deploy ./my-dist --api-location ./api
```

## 5.4 Deploy a Blazor app

To deploy a Blazor app with (optional) an API to Azure Static Web Apps, use the following steps:

1. Build your Blazor app in Release mode:

```bash
dotnet publish -c Release
```

2. From the root of your project, run the deploy command:

```bash
swa deploy ./Client/bin/Release/net6.0/publish/wwwroot --api-location ./Api
```

## 5.5 Deploy using the `swa-cli.config.json`

If you are using a [`swa-cli.config.json`](#swa-cli.config.json) configuration file in your project and have a single configuration entry, for example:

```json
{
  "configurations": {
    "my-app": {
      "appLocation": "./",
      "apiLocation": "api",
      "outputLocation": "frontend",
      "start": {
        "outputLocation": "frontend"
      },
      "deploy": {
        "outputLocation": "frontend"
      }
    }
  }
}
```

Then you can deploy your application by running the following steps:

1. If your front-end application requires a build step, run the build step (e.g. `npm run build`) or refer to your application build instructions.

2. Deploy your app:

```bash
swa deploy
```

If you have multiple configuration entries, you can provide the entry ID to specify which one to use:

```bash
swa deploy my-otherapp
```
