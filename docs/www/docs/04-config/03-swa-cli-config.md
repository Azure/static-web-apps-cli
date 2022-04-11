---
sidebar_position: 3
---

# SWA CLI Config File


## Usage

The CLI can also load options from a `swa-cli.config.json` file.

```json
{
  "configurations": {
    "app": {
      "context": "http://localhost:3000",
      "apiLocation": "api",
      "run": "npm run start",
      "swaConfigLocation": "./my-app-source"
    }
  }
}
```

 * If only a single configuration is present in the `swa-cli.config.json` file, running `swa start` will use it by default.
 * If options are loaded from a config file, no options passed in via command line will be respected. For example `swa start app --ssl=true`. The `--ssl=true` option will not be picked up by the CLI.


## Example

Suppose you have these two frequently-used commands that you use for configuring your SWA in static (standalone) or devserver (with front-end dev server) modes respectively

```bash
# static configuration
swa start ./my-dist --swa-config-location ./my-app-source

# devserver configuration
swa start http://localhost:3000 --swa-config-location ./my-app-source
```

We can simplify these commands by putting the options into a config file.

```json
{
  "configurations": {
    "static": {
      "context": "./my-dist",
      "swaConfigLocation": "./my-app-source"
    },
    "devserver": {
      "context": "http://localhost:3000",
      "swaConfigLocation": "./my-app-source"
    }
  }
}
```

Now, the above commands get simplified as follows:

```bash
# static configuration
swa start static

# devserver configuration
swa start devserver
```

## Validation

You can validate your `swa-cli.config.json` with a JSON Schema like so:

```json
{
  "$schema": "https://raw.githubusercontent.com/Azure/static-web-apps-cli/main/schema/swa-cli.config.schema.json",
  "configurations": {
    ...
  }
}
```