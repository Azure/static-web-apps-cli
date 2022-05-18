# Building and Testing Azure Static Web Apps CLI (SWA CLI)

This document describes how to set up your development environment to build and test the Azure Static Web Apps CLI (SWA CLI).
It also explains the basic mechanics of using `git`, `node`, and `npm`.

- [Building and Testing Azure Static Web Apps CLI (SWA CLI)](#building-and-testing-azure-static-web-apps-cli-swa-cli)
  - [Prerequisite Software](#prerequisite-software)
  - [Getting the Sources](#getting-the-sources)
  - [Installing NPM Modules](#installing-npm-modules)
  - [Building](#building)
  - [Running Tests Locally](#running-tests-locally)
    - [Testing changes against a local project](#testing-changes-against-a-local-project)
  - [Formatting your source code](#formatting-your-source-code)
    - [Atom](#atom)
    - [Emacs:](#emacs)
    - [Espresso:](#espresso)
    - [Nova:](#nova)
    - [Sublime Text:](#sublime-text)
    - [Vim:](#vim)
    - [Visual Studio](#visual-studio)
    - [VS Code](#vs-code)
    - [WebStorm](#webstorm)

See the [contribution guidelines](https://github.com/azure/static-web-apps-cli/blob/main/CONTRIBUTING.md) if you'd like to contribute to this project.

## Prerequisite Software

Before you can build and test SWA CLI, you must install and configure the following products on your development machine:

- [Git](https://git-scm.com/) and/or the [**GitHub app**](https://desktop.github.com/) (for Mac and Windows);
  [GitHub's Guide to Installing Git](https://help.github.com/articles/set-up-git) is a good source of information.

- [Node.js](https://nodejs.org), (version specified in the engines field of [`package.json`](../package.json)) which is used to run a development web server, run tests, and generate distributable files.

- [npm](https://www.npmjs.com/) (version specified in the engines field of [`package.json`](../package.json)) which is used to install dependencies.

## Getting the Sources

Fork and clone the SWA CLI repository:

1. Login to your GitHub account or create one by following the instructions given [here](https://github.com/signup/free).

2. [Fork](https://help.github.com/forking) the [main SWA CLI repository](https://github.com/azure/static-web-apps-cli).

3. Clone your fork of the SWA CLI repository:

```bash
git clone https://github.com/{YOUR_GITHUB_ACCOUNT}/static-web-apps-cli.git
```

4. **OPTIONAL**: Clone a specific feature branch:

```bash
git clone -b BRANCH_NAME https://github.com/{YOUR_GITHUB_ACCOUNT}/static-web-apps-cli.git
```

5. Go to the SWA CLI directory:

```bash
cd static-web-apps-cli
```

6. Define an `upstream` remote pointing back to the SWA CLI repository that you forked in the first place

```bash
git remote add upstream https://github.com/azure/static-web-apps-cli.git
```

## Installing NPM Modules

Next, install SWA CLI project dependencies defined in the [`package.json`](../package.json)) file:

```bash
npm install
```

## Building

To build SWA CLI, run:

```bash
npm run build
```

This step will create a `./dist` folder containing the built project.

Test that the CLI is running as expected using the command:

```bash
node dist/cli/bin.js -h
```

## Running Tests Locally

You should execute all test suites before submitting a PR to GitHub.

- `npm test` will run all test suites.

### Testing changes against a local project

Often for developers the best way to ensure the changes they have made work as expected is to run use changes in another library or project. To do this developers can build SWA CLI locally, and using `npm link` build a local project with the created artifacts.

From the root folder of your project (where `package.json` is located), run:

```bash
npm link ./
```

Now you can run `swa -h` from anywhere in your system and this will run the CLI from your `./dist` folder.

When making multiple changes to the project source files, you can run `npm run watch` which will watch and rebuild the project on the fly

## Formatting your source code

SWA CLI uses [prettier](https://prettier.io/) to format the source code. If the source code is not properly formatted, the CI will fail and the PR cannot be merged.

You can automatically format your code by running:

- `npm run format`: format _all_ source code

A better way is to set up your IDE to format the changed file on each file save.

### Atom

- [https://github.com/prettier/prettier-atom](https://github.com/prettier/prettier-atom)
- [https://github.com/t9md/atom-mprettier](https://github.com/t9md/atom-mprettier)
- [https://github.com/duailibe/atom-miniprettier](https://github.com/duailibe/atom-miniprettier)

### Emacs:

- [https://github.com/prettier/prettier-emacs](https://github.com/prettier/prettier-emacs)
- [https://github.com/jscheid/prettier.el](https://github.com/jscheid/prettier.el)
- [https://github.com/raxod502/apheleia](https://github.com/raxod502/apheleia)

### Espresso:

- [https://github.com/eablokker/espresso-prettier](https://github.com/eablokker/espresso-prettier)

### Nova:

- [https://extensions.panic.com/extensions/alexanderweiss/alexanderweiss.prettier](https://extensions.panic.com/extensions/alexanderweiss/alexanderweiss.prettier)

### Sublime Text:

- [https://packagecontrol.io/packages/JsPrettier](https://packagecontrol.io/packages/JsPrettier)

### Vim:

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
