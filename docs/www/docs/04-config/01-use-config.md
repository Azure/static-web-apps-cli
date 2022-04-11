---
sidebar_position: 1
---

# SWA Config File

Azure Static Web Apps can be configured with an optional `staticwebapp.config.json` file. See [Configure Static Web Apps documentation](https://docs.microsoft.com/azure/static-web-apps/configuration) to learn more.

## Using Default Locations

If you serve your static files from a specific folder, the SWA CLI will automatically search that folder for `staticwebapp.config.json`.

```bash
# searches ./my-dist for staticwebapp.config.json
swa start ./my-dist
```

If you use a front-end dev server, the CLI will search the _current directory_ for your `staticwebapp.config.json`.

```bash
# searches current directory for staticwebapp.config.json
swa start http://localhost:3000
```

## Specify Custom Location

To control where the CLI searches for `staticwebapp.config.json`, use `--swa-config-location`.

```bash
# static files
swa start ./my-dist --swa-config-location ./my-app-source

# frontend dev server
swa start http://localhost:3000 --swa-config-location ./my-app-source