---
id: Troubleshooting
title: Troubleshooting
sidebar_position: 99
---

# Troubleshooting

:::info
This page lists frequently-asked questions and solutions to help troubleshoot common issues that may be encountered when building or testing the project.
:::

## `libsecret-1.so.0: cannot open shared object file: No such file or directory`

### Context

When using `swa login`, the flag `--use-keychain` is enabled by default because we encrypt and store your credentials in your native Keychain (aka. the built-in password manager of your operating system).  This operation depends on a system dependency called `libsecret`. If your system doesn't come bundled `libsecret` (most systems do provide it by default), you will then encounter this error.

### Why do I need to `swa login`?

In order to be able to automatically deploy your app to your Azure Static Web Apps instance, we need a Deployment Token. To automate that operation and avoid asking the users to manually find that deployment token, which can take several steps, we provide a built-in and convenient option to do that: `swa login`.

### Solutions

In order to avoid this issue, you have 2 options:
1. [Manually install](https://www.google.com/search?q=instal+libsecret) `libsecret` by adding it to your Docker image or your system (recommended)
2. Disable Keychain access using `--no-use-keychain`. Doing so won't store and remember your credentials anymore, and you will have to interactively log in again each time you run `swa login`
3. Manually provide the Deployment Token for your current project (see [SWA CLI docs](https://azure.github.io/static-web-apps-cli/docs/use/deploy#51-deployment-token)). You will also need to provide `--app-name` and `--resource-group-name`
4. Manually provide `--client-id`, `--client-secret`, `--app-name` and `--resource-group-name`.


---
