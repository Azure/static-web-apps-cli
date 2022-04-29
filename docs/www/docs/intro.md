---
sidebar_position: 1
---

# About SWA CLI

The **Static Web Apps (SWA) CLI** is an open-source commandline tool used for simplifying local development and deployment workflows for Azure Static Web Apps.

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/azure/static-web-apps-cli/issues)


## What is Static Web Apps?

Azure Static Web Apps is a turnkey service for modern full-stack applications with pre-built or pre-rendered front-ends, and serverless backends. It became [generally available in May 2021](https://azure.microsoft.com/en-us/updates/azure-static-web-apps-is-now-generally-available/?WT.mc_id=30daysofswa-61155-cxall) and:

 * works with [your favorite front-end frameworks and static site generators](https://docs.microsoft.com/en-us/azure/static-web-apps/front-end-frameworks) 
 * has [quickstart options](https://docs.microsoft.com/en-us/azure/static-web-apps/getting-started?tabs=vanilla-javascript) for IDE, command line, and browser (via Azure Portal).
 * can automate workflows for code repositories in [GitHub](https://docs.microsoft.com/en-us/azure/static-web-apps/getting-started?tabs=vanilla-javascript), [GitLab](https://docs.microsoft.com/en-us/azure/static-web-apps/gitlab?tabs=vanilla-javascript) and [Bit Bucket](https://docs.microsoft.com/en-us/azure/static-web-apps/bitbucket?tabs=vanilla-javascript).

Visit the [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/) for more information.

## What is SWA CLI?

The Static Web Apps CLI (aka **SWA CLI**) is an [open-source](https://github.com/Azure/static-web-apps-cli) command-line tool to support local development for [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps). Using the SWA CLI, you can:

- Serve static app assets, or proxy to your app dev server
- Serve API requests, or proxy to APIs running in Azure Functions Core Tools
- Emulate authentication and authorization (with mock responses)
- Emulate Static Web Apps configuration (including routing & role-based auth)
- Deploy your app to Azure Static Web Apps (for a unified develop-deploy workflow)


## SWA CLI Components

At a high level, the architecture looks something like this:

![Static Web Apps CLI Architecture](../static/img/swa-cli-arch.png)

The key components of the SWA CLI are:

- A **Reverse Proxy**. The heart of the CLI. It forwards HTTP requests to the appropriate components:
  - `/.auth/**` requests are forwarded to the Auth emulator server.
  - `/api/**` requests are forwarded to the localhost API function (if available).
  - `/**` all other requests are forwarded to the static assets server (serving the front-end app).
- The **Auth emulator server**. Emulates auth flow, returning mock responses.
- The **Static content server**. Serves app's static content locally for testing, validation.
- The **Serverless API server**. Served by Azure Functions Core Tools, for local API testing.

>  **```🚨 CAVEAT: STATIC WEB APPS CLI IS CURRENTLY IN PREVIEW. 🚨```** <br/> It _emulates_ key capabilities of the Azure Static Web Apps service, so differences from actual behavior are to be expected. Deploy and test your app in Azure for final validation.


## Contribute to SWA CLI

Static Web Apps CLI preview release v0.8.3 was releaseed in **April 2022**. The v1.0 release is expected to launch in **May 2022** with enhanced commands and features.

This is an open-source project made for the benefit of our developer community. Your feedback and contributions are key to its success. Here are some ways to help:

 * Discovered buggy or unusual behavior? [Send us a bug report](https://github.com/Azure/static-web-apps-cli/issues/new?assignees=&labels=&template=bug_report.md&title=)
 * Have a feature request? [Send us a Feature Request](https://github.com/Azure/static-web-apps-cli/issues/new?assignees=&labels=&template=feature_request.md&title=)
 * Found a security vulnerability? [Report Security Issues](https://github.com/Azure/static-web-apps-cli/security/policy)
 * Have other questions or comments? [Post to our Discussions board](https://github.com/Azure/static-web-apps-cli/discussions)
 * Posting questions to Stack Overflow? [Post to the swa-cli tag](https://stackoverflow.com/questions/tagged/swa-cli)

You can also contribute directly to the project by:
 * Fixing bugs identified in issues
 * Writing or improving the documentation
 * Extending or improving CLI capabilities

To get started, read our [Contributor Guide](/docs/contribute/intro)


Thank you for your continued support! ♥️