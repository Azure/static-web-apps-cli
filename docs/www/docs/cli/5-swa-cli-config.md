---
sidebar_position: 4
---

# `swa-cli.config.json`

The CLI can also load options from a `swa-cli.config.json` file:

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

If only a single configuration is present in the `swa-cli.config.json` file, running `swa start` will use it by default. If options are loaded from a config file, no options passed in via command line will be respected. For example `swa start app --ssl=true`. The `--ssl=true` option will not be picked up by the CLI.

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
