---
sidebar_position: 1
---

# 1. Introduction

## About Static Web Apps

[Azure Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/) is a cloud-based service that makes it effortless for a modern web app developer to build and deploy their applications _directly from the codebase_.

Azure Static Web Apps simplify developer workflows by seamlessly linking together multiple services so they work as a seamless, unified application. Services include:
 * Static Web App (assets hosting)
 * Azure Functions API (serverless backend)
 * Authentication and Authorization (user accounts)
 * Routing and Configuration (user experience)

Azure Static Web Apps handles these integrations for you on deployment to the cloud. But how can we validate and test these interactions during development?

**That's where the Static Web Apps CLI comes in!**


 ## About SWA CLI

The [Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli) makes it easier to [set up local development](https://docs.microsoft.com/en-us/azure/static-web-apps/local-development) for Azure Static Web Apps by providing local, proxy and emulation services for testing and validation of application workflows. 

Here's what the high-level architecture looks like:

![Static Web Apps CLI Architecture](../static/img/swa-cli-arch.png)

The SWA CLI is built on top of the following components:

- A **Reverse Proxy**. This is the heart of the SWA CLI, forwarding all HTTP requests to the appropriate components:
  - `/.auth/**` requests are forwarded to the Auth emulator server.
  - `/api/**` requests are forwarded to the localhost API function (if available).
  - `/**` all other requests are forwarded to the static assets server (serving the front-end app).
- The **Auth emulator server** emulates the whole authentication flow.
- The **Static content server** serves the local app static content.
- The **Serverless API server** is served by Azure Functions Core Tools.


Learn more about [How it works](https://docs.microsoft.com/en-us/azure/static-web-apps/local-development#how-it-works).
Now let's get started with the **Static Web Apps CLI Quickstart**.
