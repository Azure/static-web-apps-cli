---
sidebar_position: 7
title: Environment Variables
---

# Environment Variables

## General Settings

| Environment Variable | Purpose                                                                            | Read Only? | Default Value |
| -------------------- | ---------------------------------------------------------------------------------- | ---------- | ------------- |
| SWA_CLI_VERSION      | CLI version                                                                        | Yes        |               |
| SWA_CLI_DEBUG        | Enable verbose logs (`silly`, `silent`, `log`, `info` or `error`)                  |            | `log`         |
| DEBUG                | General purpose environment variable used to enable verbose logs for commong tools |            |               |

## Emulator Settings

| Environment Variable      | Purpose                                                                                             | Read Only? | Default Value |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ---------- | ------------- |
| SWA_CLI_API_LOCATION      | Folder containing the source code of the API application                                            |            | `./api`       |
| SWA_CLI_APP_LOCATION      | Folder containing the source code of the front-end application                                      |            | `./`          |
| SWA_CLI_OUTPUT_LOCATION   | Folder containing the front-end public files                                                        |            | `./`          |
| SWA_CLI_HOST              | Host address to use for the CLI dev server                                                          |            | `localhost`   |
| SWA_CLI_PORT              | Host port to use for the CLI dev server                                                             |            | `4280`        |
| SWA_CLI_API_PORT          | API server port to use                                                                              |            | `7071`        |
| SWA_CLI_APP_SSL           | Use HTTPS to serve the front-end application and API (`true` or `false`)                            |            | `false`       |
| SWA_CLI_APP_SSL_KEY       | SSL key (.key) to use when enabling HTTPS                                                           |            |               |
| SWA_CLI_APP_SSL_CERT      | SSL certificate (.crt) to use when enabling HTTPS                                                   |            |               |
| SWA_CLI_STARTUP_COMMAND   | Run a custom shell command or script file at startup                                                |            |               |
| SWA_CLI_OPEN_BROWSER      | Automatically open the CLI dev server in the default browser (`true` or `false`)                    |            | `false`       |
| SWA_CLI_SERVER_TIMEOUT    | The time to wait (in seconds) when connecting to a front-end application's dev server or api server |            | `60`          |
| SWA_CLI_APP_DEVSERVER_URL | Connect to the dev server at this URL instead of using output location                              |            |               |
| SWA_CLI_API_DEVSERVER_URL | Connect to the api server at this URL instead of using output location                              |            |               |

## Deploy settings

| Environment Variable          | Purpose                                                                   | Read Only? | Default Value |
| ----------------------------- | ------------------------------------------------------------------------- | ---------- | ------------- |
| SWA_CLI_APP_NAME              | Project name                                                              |            |               |
| SWA_CLI_DEPLOYMENT_TOKEN      | Secret token used to authenticate with the Static Web Apps                |            |               |
| SWA_CLI_DEPLOY_DRY_RUN        | Simulate a deploy process without actually running it (`true` or `false`) |            | `false`       |
| SWA_CLI_DEPLOY_BINARY_VERSION | Deployment binary version to use                                          |            | `stable`      |
| SWA_CLI_DEPLOY_BINARY         | Absoluate path to the deploy binary                                       | Yes        |               |
| SWA_CLI_DEPLOY_ENV            | the type of deployment environment where to deploy the project            |            | `preview`     |
| AZURE_REGION_LOCATION         | Azure region where to deploy the project                                  |            | `West US 2`   |
| AZURE_RESOURCE_GROUP          | Azure resource group                                                      |            |               |
| AZURE_SUBSCRIPTION_ID         | Azure subscription ID                                                     |            |               |

## Runtime settings

| Environment Variable          | Purpose                                                            | Read Only? | Default Value |
| ----------------------------- | ------------------------------------------------------------------ | ---------- | ------------- |
| SWA_RUNTIME_CONFIG            | Absolute path to `staticwebapp.config.json`                        |            |               |
| SWA_RUNTIME_CONFIG_LOCATION   | Folder containing the file `staticwebapp.config.json`              |            |               |
| SWA_RUNTIME_WORKFLOW_LOCATION | Absolute path to `.github/workflows/azure-static-web-apps-xyz.yml` | Yes        |               |

## Azure Identity

| Environment Variable            | Purpose                                                                                          | Read Only? | Default Value |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- | ------------- |
| SWA_CLI_LOGIN_USE_KEYCHAIN      | Enable using the operating system native keychain for persistent credentials (`true` or `false`) |            | `true`        |
| SWA_CLI_LOGIN_CLEAR_CREDENTIALS | Clear clear persisted credentials before login (`true` or `false`)                               |            | `false`       |
| AZURE_CLIENT_ID                 | Azure Active Directory client ID                                                                 |            |               |
| AZURE_CLIENT_SECRET             | Azure Active Directory secret                                                                    |            |               |
| AZURE_TENANT_ID                 | Azure Active Directory tenant ID                                                                 |            |               |
