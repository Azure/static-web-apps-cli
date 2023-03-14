---
id: Troubleshooting
title: Troubleshooting
sidebar_position: 99
---

# Troubleshooting

:::info
This page lists frequently-asked questions and solutions to help troubleshoot common issues that may be encountered when building or testing the project.
:::

## `swa deploy` fails with no logs

### Context

`swa deploy` currently has a small bug which is being actively worked on by the team. When a user tries to `swa deploy` from within the `app-location`, the deploy command currently fails with an unknown error. This is being tracked in GitHub issue #[514]((https://github.com/Azure/static-web-apps-cli/issues/514).

### Solution

While the team is currently working on the fix, we recommend users to use the other methods of deployment, all documented [here](https://azure.github.io/static-web-apps-cli/docs/cli/swa-deploy)). In case the project does not have an `app-location` folder (i.e. main project is in the `root` folder), we'd recommend using the [Azure Static Web Apps portal](https://portal.azure.com) or [VSCode](https://docs.microsoft.com/en-us/azure/static-web-apps/getting-started?tabs=vanilla-javascript) extension meanwhile!

## `libsecret-1.so.0: cannot open shared object file: No such file or directory`

### Context

When using `swa login`, the flag `--use-keychain` is enabled by default because we encrypt and store your credentials in your native Keychain (aka. the built-in password manager of your operating system). This operation depends on a system dependency called `libsecret`. If your system doesn't come bundled `libsecret` (most systems do provide it by default), you will then encounter this error.

### Why do I need to `swa login`?

In order to be able to automatically deploy your app to your Azure Static Web Apps instance, we need a Deployment Token. To automate that operation and avoid asking the users to manually find that deployment token, which can take several steps, we provide a built-in and convenient option to do that: `swa login`.

### Solutions

In order to avoid this issue, you have a few options:

1. [Manually install](https://www.google.com/search?q=instal+libsecret) `libsecret` by adding it to your Docker image or your system (recommended)
2. Disable Keychain access using `--no-use-keychain`. Doing so won't store and remember your credentials anymore, and you will have to interactively log in again each time you run `swa login`
3. Manually provide the Deployment Token for your current project (see [SWA CLI docs](https://azure.github.io/static-web-apps-cli/docs/use/deploy#51-deployment-token)). You will also need to provide `--app-name` and `--resource-group`
4. Manually provide `--client-id`, `--client-secret`, `--app-name` and `--resource-group`.

## SWA CLI - Domains that need Firewall access

### Context

If you are having trouble accessing SWA CLI, the following domains need to be allowed an access in your firewall:

- blob.core.windows.net
- azurestaticapps.net
- swalocaldeploy.azureedge.net
- dataapibuilder.azureedge.net
- functionscdn.azureedge.net

## `Unable to download StaticSitesClient binary (File Not Found 404 - 403)`

### Context

SWA CLI uses an external binary `StaticSitesClient` to deploy apps to Azure Static Web Apps. This binary is downloaded on demand when users run `swa deploy` for the first time. SWA CLI then detects the host OS in order to download the right binary version from https://swalocaldeploy.azureedge.net/downloads/versions.json.

It can happen that the host firewall can block downloading these binaries. If users can't configure the firewall rules to allow SWA CLI accessing https://swalocaldeploy.azureedge.net/, as a workaround, they can manually download `StaticSitesClient`.

### Solution

1. Visit https://swalocaldeploy.azureedge.net/downloads/versions.json
2. Copy the `stable` JSON content, for eg:

```json
{
  "version": "stable",
  "buildId": "<StaticSiteClient version>",
  "publishDate": "<publishDate>",
  "files": {
    "linux-x64": {
      "url": "https://swalocaldeploy.azureedge.net/downloads/<StaticSitesClient version>/linux/StaticSitesClient",
      "sha": "<Hash value of the StaticSitesClient Linux Binary>"
    },
    "win-x64": {
      "url": "https://swalocaldeploy.azureedge.net/downloads/<StaticSitesClient version>/windows/StaticSitesClient.exe",
      "sha": "<Hash value of the StaticSitesClient Windows Binary>"
    },
    "osx-x64": {
      "url": "https://swalocaldeploy.azureedge.net/downloads/<StaticSitesClient version>/macOS/StaticSitesClient",
      "sha": "<Hash value of the StaticSitesClient MacOS Binary>"
    }
  }
}
```

3. Based on your operating system, download the right binary from the provided URLs:
   1. Linux: https://swalocaldeploy.azureedge.net/downloads/<StaticSitesClient version>/linux/StaticSitesClient
   2. Windows: https://swalocaldeploy.azureedge.net/downloads/<StaticSitesClient version>/windows/StaticSitesClient.exe
   3. macOS: https://swalocaldeploy.azureedge.net/downloads/<StaticSitesClient version>/macOS/StaticSitesClient
1. Copy this binary to `$HOME/.swa/deploy/VERSION/StaticSiteClient` (add `.exe` for Windows). For eg:
   `/home/USER/.swa/deploy/<StaticSitesClient version>/StaticSiteClient`
1. Create a file at `$HOME/.swa/deploy/StaticSitesClient.json` with the following content:

```json
{
   "metadata": PASTE STABLE JSON CONTENT,
   "binary": ABSOLUTE PATH TO STATIC SITE CLIENT BINARY,
   "checksum": SH256 CHECKSUM OF THE BINARY SEE BELOW
}
```

For example:

```json
{
   "metadata": {
    "version": "stable",
    "buildId": "1.0.020761",
    ...
  },
   "binary":"/home/USER/.swa/deploy/1.0.020761/StaticSitesClient",
   "checksum": "360b76959c68cc0865b1aea144c8eb2aa413f4856e55c781a83bd7e1ad352362"
}
```

**IMPORTANT: Make sure the `StaticSitesClient.json#checksum` and `StaticSitesClient.json#metadata.files.[OS].sha` values match!** 6. For Linux and macOS, run `chmod +x /home/USER/.swa/deploy/<StaticSiteClient version>/StaticSitesClient` 7. Run `swa deploy --verbose silly` and make sure `SWA_CLI_DEPLOY_BINARY` is set correctly. If everything was configured correctly, the deploy should work.

How to compute SHA256 checksum:

1. On Windows using Powershell:

```
PS C:\Users\USER> (Get-fileHash -Algorithm SHA256 .\.swa\deploy\VERSION\StaticSitesClient.exe).Hash.ToLower()
```

2. On Linux:

```
➜ sha256sum ~/.swa/deploy/VERSION/StaticSitesClient | head -c 64
```

3. On macOS:

```
➜ openssl sha256 ~/.swa/deploy/VERSION/StaticSitesClient | awk '{print $2}'
```

---
