---
sidebar_position: 2
---

# Build From Source

This document describes how to set up your development environment to build and test the Azure Static Web Apps CLI. In the documentation we may refer to it interchangeably as **SWA CLI** or simply as **`swa`**.

Please [**review the Contribution Guidelines**](/docs/contribute/intro) if you plan to contribute back to the project codebase (by fixing issues, editing docs etc.).

---

## 1. Build Requirements

### Install Git

:::info

> **Installation Guide: ** Follow the [GitHub's Guide to Installing Git](https://help.github.com/articles/set-up-git) guidance for setup.
> :::

The SWA CLI codebase contains both [source code](https://github.com/Azure/static-web-apps-cli/tree/main/src)
and [documentation files](https://github.com/Azure/static-web-apps-cli/tree/main/docs) for the project - all hosted **in the same GitHub repository**.

You will need to install [**Git**](https://git-scm.com/) (command-line utility) or [**GitHub Desktop**](https://desktop.github.com/) (IDE for Windows/macOS only) to work with our codebase. This allows you to:

- fork and clone the SWA CLI codebase for local development
- maintain source code and version control over files in your fork
- streamline pull request (PR) workflows to contribute back changes

If you're new to Git, we recommend the and follow the instructions for your preferred development platform (Linux, Windows, macOS or other), to set this up.

### Install Node.js

:::info

> **Installation Guide: ** Follow the [Downloading & installing Node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) guidance for setup.
> :::

The SWA CLI is written in JavaScript/TypeScript and built for execution in a [**Node.js**](https://nodejs.org/en/) runtime on the desktop. The SWA CLI is also packaged and distributed as [@azure/static-web-apps-cli](https://www.npmjs.com/package/@azure/static-web-apps-cli) in the [npm registry](https://www.npmjs.com/).

You will need to install [**Node.js**](https://nodejs.org) to preview, run, and test, the SWA CLI. You'll also need to install [**npm**](https://docs.npmjs.com/cli/v8/using-npm/developers) to handle package dependencies and configure scripts to streamline developer workflows with Node.js.

This allows you to:

- use [npm install](https://docs.npmjs.com/cli/v8/commands/npm-install) to install SWA CLI dependencies in `package.json`.
- use [npm run](https://docs.npmjs.com/cli/v8/commands/npm-run-script) to execute "scripts" defined in `package.json`
- use [npm test](https://docs.npmjs.com/cli/v8/commands/npm-test) to run the "test" script in `package.json`
- use [npm run format](#formatting-your-source-code) to format source when getting ready to PR.

We strongly agree with the recommendation to **[use the Node Version Manager (nvm)](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)** to manage your installs - [nvm](https://github.com/nvm-sh/nvm) makes it easy to install, and switch between, [multiple versions](https://nodejs.org/en/about/releases/) of Node, directly from the command line.

:::info
**Version Requirements: **
Installed versions must meet the `engines` requirements for this project.
:::

The `engines` object defines the minimum versions of Node.js and npm that are required for SWA CLI, in this [package.json](../../../../package.json). The object looks something like this:

```json
  "engines": {
    "node": ">=14.0.0",
    "npm": ">=6.0.0"
  }
```

This indicates that the current SWA CLI works with a minimum version of Node.js v14.0.0 and npm v6.0.0. Check your current dev environment versions by using the `--version` option. Here's an example of usage:

```bash
$ node --version
v16.2.0

$ npm --version
7.13.0
```

Need to change versions to meet requirements? Use [nvm](https://github.com/nvm-sh/nvm):

```bash
// List locally-installed versions
nvm list

// Switch to an installed version (if requirement met)
nvm use <installed-version>

// .. Or find version to install (that meets requirement)
nvm ls-remote

// .. And install it locally
nvm install <remote-version>

// .. Then validate install worked
nvm which <remote-version>

// .. And switch to use it
nvm use <remote-version>
```

---

## 2. Clone The Project

Once you've met the build requirements, you can download the SWA CLI codebase and configure it for local development using these steps:

:::info
The SWA CLI codebase is hosted [here on GitHub](https://github.com/azure/static-web-apps-cli) and contains both the **source code** and the **documentation files** for the project.
:::

**First**, fork the repository and clone it for local development.

```bash
git clone https://github.com/{YOUR_GITHUB_ACCOUNT}/static-web-apps-cli.git
```

**Optionally**, clone a specific branch using `-b BRANCH_NAME`:

```bash
git clone -b BRANCH_NAME https://github.com/{YOUR_GITHUB_ACCOUNT}/static-web-apps-cli.git
```

**Next**, switch your working directory to the _SWA CLI_ project root:

```bash
cd static-web-apps-cli
```

**Next**, add an `upstream` remote pointing back to the original SWA CLI repository. This makes it easier to fetch updates and contribute PRs.

```bash
git remote add upstream https://github.com/azure/static-web-apps-cli.git
```

## 3. Build The Project

### Install Deps

The [`package.json`](../../../../package.json) file describes the project's dependencies. Use the following command to setup your local development environment. The process may take a few minutes.

```bash
npm install
```

### Build Dist

To build the SWA CLI distribution, run the folllowing command. This may take a few minutes.

```bash
npm run build
```

On successful completion, it creates a `dist/` folder with the following contents (output cleaned up for clarity).

```bash
$  ls dist

  cli/
  config.d.ts.map
  config.js.map
  msha/
  schema/
  config.d.ts
  config.js
  core/
  public/
```

### Validate CLI

Validate that the CLI build works by running the following command:

```bash
node dist/cli/bin.js -h
```

You should see _something like this_. Your exact output will depend on the release version you are working with.

```bash
Welcome to Azure Static Web Apps CLI

Usage: swa [command] [options]

Options:
  -v, --version                                                output the version number
  -V, --verbose [prefix]                                       enable verbose output. Values are: silly,info,log,silent (default: "log", preset: "log")
  -c, --config <path>                                          path to swa-cli.config.json file to use (default: "swa-cli.config.json")
  -cn, --config-name <name>                                    name of the configuration to use
  -g, --print-config                                           print all resolved options (default: false)
  -h, --help                                                   display help for command

Commands:
  login [options]                                              login into Azure
  start [options] [configName|outputLocation|appDevserverUrl]  start the emulator from a directory or bind to a dev server
  deploy [options] [configName|outputLocation]                 deploy the current project to Azure Static Web Apps
  init [options] [configName]                                  initialize a new static web app project
  build [options] [configName|appLocation]                     build your project

  Type "swa" to get started and deploy your project.

  Documentation:
    https://aka.ms/swa/cli-local-development

```

:::note Congratulations!!
You have successfully built and run the SWA CLI in your local env.
:::

## 4. Prep Contributions

If you forked the project with the intent of contributing back to the original codebase, we have three steps you need to take:

1.  [**Review the Contribution Guidelines**](/docs/contribute/intro)
2.  [**Test your changes against a local project**](#run-tests)
3.  [**Format your source to align with our guidelines**](#4-format-source)

### Run Tests

Use this command to run all test suites on your project's PR-ready branch before you initiate the pull request.

```bash
npm test
```

The process may take a few minutes to complete all test suites - track progress by monitoring the (verbose) test output. A successful run will likely end with something like this:

```bash
..
..
Test Suites: 27 passed, 27 total
Tests:       5 skipped, 423 passed, 428 total
Snapshots:   5 passed, 5 total
Time:        37.658 s
```

### Create Symlink

A good way to validate the changes you make is to use with with a real application project that can benefit from using the Static Web Apps CLI. The [`npm link`](https://docs.npmjs.com/cli/v8/commands/npm-link) command can help you setup your local development environment to do this transparently.

**Using npm link**

Run the following command in the root folder where `package.json` is located:

```bash
npm link ./
```

Once command completes successfully,run `swa` from any directory on your local development system.

```bash
cd <some-project-dir>
swa --h
```

You should see the `swa` output reflect the version and functionality provided by the locally-built distribution previously linked. You can now test the `swa` capability with real projects in your local development device, to validate your changes.

**How does npm link work?**

The [`npm link`](https://docs.npmjs.com/cli/v8/commands/npm-link) docs have more detail, but here's a short overview that can help you debug any issues with usage later.

1. Your local dev environment has a global folder for installed node packages. It's located at `{prefix}/lib/node_modules/` - find the prefix for your local dev setup using `npm prefix -g`.

2. Installing a package `xyz` globally (e.g., with `npm -g install xyz`) creates a subfolder `{prefix}/lib/node_modules/xyz` - making it possible for local projects with this dependency, to find and use it transparently.

3. For a local implementation of `xyz`, use `npm link ./` in the root folder (location of `package.json`). This converts `{prefix}/lib/node_modules/xyz` to a _symbolic link_ to your local distribution, making it the default for resolving that dependency.

:::note Troubleshooting
The `npm unlink` command is an alias for `npm uninstall` which may not work as intuitively as you might expect [(_see issue_)](https://github.com/npm/npm/issues/4005). As recommended there,

- use `npm unlink **-g**` to remove symbolic link from global folder
- verify there is no symlink at `{prefix}/lib/node_modules/<pkg>`
  :::

### Watch Mode

When making multiple changes to project source files, you might want to get instantaneous feedback on how these impact the project build. Use the following command instead of `npm run build`:

```bash
npm run watch
```

You should see console output similar to that shown below. Now, as you make changes to files (and save them), the project will be automatically rebuilt and status updated on the terminal.

```bash
Starting compilation in watch mode...

Found 0 errors. Watching for file changes.
```

## 4. Format Source

SWA CLI uses [prettier](https://prettier.io/) to format the source code. We require code to be formatted properly in the Pull Request (PR) - else the CI workflow will fail and your PR cannot be merged. To resolve this, **run this command to format _all_ source code**

```bash
npm run format
```

A better approach is to configure the settings in your preferred IDE to auto-format your source code files on each _Save_. Check out the relevant links for popular IDEs below. **Don't see your favorite IDE listed?** _Try [contributing to the project!](/docs/contribute/intro)!_.

### Atom

- [https://github.com/prettier/prettier-atom](https://github.com/prettier/prettier-atom)
- [https://github.com/t9md/atom-mprettier](https://github.com/t9md/atom-mprettier)
- [https://github.com/duailibe/atom-miniprettier](https://github.com/duailibe/atom-miniprettier)

### Emacs

- [https://github.com/prettier/prettier-emacs](https://github.com/prettier/prettier-emacs)
- [https://github.com/jscheid/prettier.el](https://github.com/jscheid/prettier.el)
- [https://github.com/raxod502/apheleia](https://github.com/raxod502/apheleia)

### Espresso

- [https://github.com/eablokker/espresso-prettier](https://github.com/eablokker/espresso-prettier)

### Nova

- [https://extensions.panic.com/extensions/alexanderweiss/alexanderweiss.prettier](https://extensions.panic.com/extensions/alexanderweiss/alexanderweiss.prettier)

### Sublime Text

- [https://packagecontrol.io/packages/JsPrettier](https://packagecontrol.io/packages/JsPrettier)

### Vim

- [https://github.com/prettier/vim-prettier](https://github.com/prettier/vim-prettier)
- [https://github.com/sbdchd/neoformat](https://github.com/sbdchd/neoformat)
- [https://github.com/w0rp/ale](https://github.com/w0rp/ale)
- [https://github.com/neoclide/coc-prettier](https://github.com/neoclide/coc-prettier)

### Visual Studio

- [https://github.com/madskristensen/JavaScriptPrettier](https://github.com/madskristensen/JavaScriptPrettier)

### VS Code

- [https://github.com/prettier/prettier-vscode](https://github.com/prettier/prettier-vscode)

### WebStorm

- [https://prettier.io/docs/en/webstorm.html](https://prettier.io/docs/en/webstorm.html)
