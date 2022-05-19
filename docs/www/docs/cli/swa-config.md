---
sidebar_position: 8
title: Configuring file
---

## `swa-cli.config.json`

The SWA CLI gets configuration information for your Azure Static Web Apps in one of two ways:

- from CLI options (passed in at runtime)
- from a CLI configuration file (created and stored in project)

:::info
By default, the SWA CLI looks for a configuration file called **`swa-cli.config.json`** in the **current directory**.
:::

The configuration file can contain multiple configurations (e.g., one per project), each identified by a unique configuration name.

- If only a single configuration is present in the `swa-cli.config.json` file, running `swa start` will use it by default.
- If options are loaded from a config file, no options passed in via command line will be respected. For example if we use `swa start app --ssl`, the `ssl=true` option will not be picked up by the CLI.

## Configuration File Example

```json
{
  "configurations": {
    "app": {
      "appDevserverUrl": "http://localhost:3000",
      "apiLocation": "api",
      "run": "npm run start",
      "swaConfigLocation": "./my-app-source"
    }
  }
}
```

## Initialize a Configuration File

Use `swa init` to kickstart the workflow to create a configuration file for a new or existing project. If the project exists, `swa init` will try to make educated guesses on the configuration settings for you, with ability to override it during creation.

By default the process creates these settings in a `swa-cli.config.json` in the _current working directory_ of your project. This is the default file name/location used by `swa` when searching for project configuration info.

```bash
swa --config <path>
```

If the file contains only one named configuration, it is used by default. If multiple configurations are defined, specify the one to use at commandline

```bash
swa --config-name
```

When the configuration file option is used, the settings are stored in JSON format. Once created, you can manually edit the file to update settings (if preferred) or use `swa init` to make updates.

## View Configuration

The Static Webs CLI provides a `--print-config` option that you can use to determine _resolved_ options for your current setup.

Here is an example of what that output looks like when run on a new project (i.e., shows default settings)

```bash
swa --print-config

Options:
 - port: 4280
 - host: localhost
 - apiPort: 7071
 - appLocation: .
 - apiLocation: <undefined>
 - outputLocation: .
 - swaConfigLocation: <undefined>
 - ssl: false
 - sslCert: <undefined>
 - sslKey: <undefined>
 - appBuildCommand: <undefined>
 - apiBuildCommand: <undefined>
 - run: <undefined>
 - verbose: log
 - serverTimeout: 60
 - open: false
 - githubActionWorkflowLocation: <undefined>
 - env: preview
 - appName: <undefined>
 - dryRun: false
 - subscriptionId: <undefined>
 - resourceGroupName: <undefined>
 - tenantId: <undefined>
 - clientId: <undefined>
 - clientSecret: <undefined>
 - useKeychain: true
 - clearCredentials: false
 - config: swa-cli.config.json
 - printConfig: true
```

Running `swa --print-config` will provide the current configuration defaults.

:::info
if the project has not yet defined a configuration file, this will automatically trigger the `swa init` workflow to help you create one.
:::

## Validate Configuration

The `swa-cli.config.json` file can be validated against the following schema: https://aka.ms/azure/static-web-apps-cli/schema

## See Also

- [swa](./swa)
- [swa init](./swa-init)
- [swa start](./swa-start)

<!--
## Configuration File

The CLI can load configuration options from a JSON file (default: `swa-cli.config.json`).

* If only a single configuration is present in the `swa-cli.config.json` file, running `swa start` will use it by default.
* If options are loaded from a config file, no options passed in via command line will be respected. For example if we use `swa start app --ssl=true`, the `ssl=true` option will not be picked up by the CLI.

**Example File:**

```json
{
  "configurations": {
    "app": {
      "outputLocation": "http://localhost:3000",
      "apiLocation": "api",
      "run": "npm run start",
      "swaConfigLocation": "./my-app-source"
    }
  }
}
```

### Example

We can simplify these commands by putting the options into a config file:

```bash
# static configuration
swa start ./my-dist --swa-config-location ./my-app-source

# devserver configuration
swa start http://localhost:3000 --swa-config-location ./my-app-source
```

```json
{
  "configurations": {
    "static": {
      "outputLocation": "./my-dist",
      "swaConfigLocation": "./my-app-source"
    },
    "devserver": {
      "outputLocation": "http://localhost:3000",
      "swaConfigLocation": "./my-app-source"
    }
  }
}
```

These configurations can be run with `swa start static` and `swa start devserver`.

### Validation

You can validate your `swa-cli.config.json` with a JSON Schema like so:

```json
{
  "$schema": "https://raw.githubusercontent.com/Azure/static-web-apps-cli/main/schema/swa-cli.config.schema.json",
  "configurations": {
    ...
  }
}
```

## Local authentication & authorization emulation

The CLI allows to mock and read authentication and authorization credentials.

### Mocking credentials

When requesting the Static Web Apps login endpoints (`http://localhost:4280/.auth/login/<PROVIDER_NAME>`), you have access to a local authentication UI. This interface is served locally from the emulator and allows you to set fake user information for the current user from the provider supplied.

### Reading credentials

The front-end application can request the `http://localhost:4280/.auth/me` endpoint and a `clientPrincipal` containing the fake information will be returned by the authentication API.

Here is an example:

```json
{
  "clientPrincipal": {
    "identityProvider": "twitter",
    "userId": "<USER-UUID>",
    "userDetails": "<USER_NAME>",
    "userRoles": ["anonymous", "authenticated"],
    "claims": [
      {
        "typ": "name",
        "val": "Azure Static Web Apps"
      }
    ]
  }
}
```

The API functions can access user information using the `x-ms-client-principal` header.

See [Accessing user information](https://docs.microsoft.com/azure/static-web-apps/user-information) documentation for more details.

-->
