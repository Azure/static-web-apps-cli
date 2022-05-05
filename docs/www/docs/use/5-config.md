---
sidebar_position: 5
---

# 6. Use Runtime Config File

Azure Static Web Apps can be configured with an optional `staticwebapp.config.json` file. For more information, see [Configure Static Web Apps documentation](https://docs.microsoft.com/azure/static-web-apps/configuration).

## 6.1 Default File Location

If you are serving static files from a folder, the CLI will search this folder for `staticwebapp.config.json`.

```bash
# this assumes that ./my-dist or its subfolders contains a staticwebapp.config.json file
swa start ./my-dist
```

If you are using a front-end dev server, the CLI will search the current directory for `staticwebapp.config.json`.

```bash
# current working directory is searched for staticwebapp.config.json
swa start http://localhost:3000
```

## 6.2 Specify File Location

To control where the CLI searches for `staticwebapp.config.json`, use `--swa-config-location`.

```bash
# static files
swa start ./my-dist --swa-config-location ./my-app-source

# front-end dev server
swa start http://localhost:3000 --swa-config-location ./my-app-source
```
