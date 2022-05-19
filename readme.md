<p align="center">
  <h2 align="center">Azure Static Web Apps CLI</h2>
  <h2 align="center">
    <a href="https://www.npmjs.com/package/@azure/static-web-apps-cli">
      <img src="https://img.shields.io/npm/v/@azure/static-web-apps-cli.svg" alt="NPM version">
    </a>
    <img src="https://img.shields.io/node/v/@azure/static-web-apps-cli.svg" alt="Node version">
    <a href="https://github.com/Azure/static-web-apps-cli/actions/workflows/ci.yml">
      <img src="https://github.com/azure/static-web-apps-cli/workflows/CI/badge.svg" alt="CI status">
    </a>
    <a href="https://github.com/azure/static-web-apps-cli/issues">
      <img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg" alt="Contributions welcome">
    </a>
  </h2>
</p>
<p align="center">
  <img align="center" src="docs/swa-cli-logo.svg" width="300" alt="logo">
</p>

The Static Web Apps CLI, also known as SWA CLI, serves as a local development tool for [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps). It can:

- Serve static app assets, or proxy to your app dev server
- Serve API requests, or proxy to APIs running in Azure Functions Core Tools
- Emulate authentication and authorization
- Emulate Static Web Apps configuration, including routing and ACL roles
- Deploy your app to Azure Static Web Apps

## Important Notes

If you have suggestions or you encounter issues, please report them or help us fix them. Your contributions are very much appreciated. 🙏

The CLI emulates commonly used capabilities of the Azure Static Web Apps cloud service. **Some differences are expected. Always deploy and test your apps in Azure to confirm behavior.**

## Quickstart

### Installing the CLI with `npm`, `yarn` or `pnpm`:

- To install the CLI globally, use:

  ```bash
  npm install -g @azure/static-web-apps-cli
  ```

  > You can also install the SWA CLI inside a project (instead of globally) as a development dependency using `npm install -D @azure/static-web-apps-cli`. This is highly recommended.

### Basic usage

- Open a SWA app folder at the root (outside any /api or /app folders):

  ```bash
  cd my-awesome-swa-app
  ```

- The best way to get started is to run the `swa` command alone and follow the interactive prompts:
  ```bash
  swa
  ```

It will generate a configuration for you, then build your project and ask if you want to deploy it to Azure.

See [swa](https://azure.github.io/static-web-apps-cli/) for more details.

### Extended usage

Here are the currently supported `swa` commands. Use `swa <command> --help` to learn about options and usage for that particular command.

- [`login`](https://azure.github.io/static-web-apps-cli/docs/cli/swa-login): login into Azure
- [`init`](https://azure.github.io/static-web-apps-cli/docs/cli/swa-init): initialize a new static web app project
- [`start`](https://azure.github.io/static-web-apps-cli/docs/cli/swa-start): start the emulator from a directory or bind to a dev server
- [`deploy`](https://azure.github.io/static-web-apps-cli/docs/cli/swa-deploy): deploy the current project to Azure Static Web Apps
- [`build`](https://azure.github.io/static-web-apps-cli/docs/cli/swa-build): build your project

### Using `npx`:

- Open a SWA app folder at the root (outside any /api or /app folders):

```bash
cd my-awesome-swa-app
```

- Create a configuration for your project:

```bash
npx @azure/static-web-apps-cli init
```

- Start the emulator:

```bash
npx @azure/static-web-apps-cli start
```

- Access your SWA app from `http://localhost:4280`

See all available [commands and options](https://azure.github.io/static-web-apps-cli/).

## Want to help?

Want to file a bug, contribute some code, or improve the documentation? Excellent! Read up on our guidelines for [contributing](https://github.com/azure/static-web-apps-cli/blob/master/CONTRIBUTING.md) and then check out one of our issues in the list: [community-help](https://github.com/azure/static-web-apps-cli/issues).
