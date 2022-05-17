---
sidebar_position: 5
title: "swa login"
---

:::info Version
Updated for Azure Static Web Apps CLI (1.0.0-preview)
:::

## Synopsis

```
Usage: swa login [options]
```

## Description

Used to login to Azure.

This command is used to authenticate with Azure and get a deployment token that can be used to deploy to Azure Static Web Apps, using the [`swa deploy`](swa-deploy) command.

## Options

Here are the options you can use with `swa login`:

- `-S, --subscription-id <subscriptionId>`: Azure subscription ID used by this project (default: `process.env.AZURE_SUBSCRIPTION_ID`)
- `-R, --resource-group <resourceGroupName>`: Azure resource group used by this project
- `-T, --tenant-id <tenantId>`: Azure tenant ID (default: `process.env.AZURE_TENANT_ID`)
- `-C, --client-id <clientId>`: Azure client ID
- `-CS, --client-secret <clientSecret>`: Azure client secret
- `-n, --app-name <appName>`: Azure Static Web App application name
- `-cc, --clear-credentials`: clear persisted credentials before login (default: `false`)
- `-u, --use-keychain`: enable using the operating system native keychain for persistent credentials (default: `true`)
- `-u, --no-use-keychain`: disable using the operating system native keychain
- `-h, --help`: display help for command

## Usage

Interactive login

```
swa login
```

Interactive login without persisting credentials

```
swa login --no-use-keychain
```

Log in into specific tenant

```
swa login --tenant-id 00000000-0000-0000-0000-000000000000
```

Log in using a specific subscription, resource group or an application

```
swa login --subscription my-subscription \
          --resource-group my-resource-group \
          --app-name my-static-site
```

Login using service principal

```
swa login --tenant-id 00000000-0000-0000-0000-000000000000 \
          --client-id 00000000-0000-0000-0000-000000000000 \
          --client-secret 0000000000000000000000000000000000000000000000000000000000000000
```

## See Also

- [swa deploy](docs/cli/swa-deploy)
- [swa](docs/cli/swa)
