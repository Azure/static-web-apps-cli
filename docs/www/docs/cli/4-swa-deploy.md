---
sidebar_position: 4
---

# `swa deploy`


If you need to override the default values for the `swa deploy` subcommand, you can provide the following options:

| Option | Description | Default | Example |
|:--|:--|:--|:--|
|  `--api-location`| The folder containing the source code of the API application |`./api`  | `--api-location="./api"`|
|`--deployment-token` | The secret toekn used to authenticate with the Static Web Apps| | `--deployment-token="123"` |
| `--dry-run` |Simulate a deploy process without actually running it | `false`| `--dry-run`|
| `--print-token`|print the deployment token | `false`  | `--print-token`|
| `--env`| the type of deployment environment where to deploy the project | `preview`| `--env="production"` or `--env="preview"`|
|`--print-token` |Print the deployment token. Usefull when using `--deployment-token` on CI/CD <br/> Note: this command does not run the deployment process. | `false` | `--print-token`|

The deploy command does also support the same options as the `swa login` command.


