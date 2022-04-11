---
sidebar_position: 2
---

# Use Existing Dev Server

Many front-end frameworks provide their own CLI with associated dev server for previewing apps during development. You might prefer to use that built-in dev server to take advantage of features like _livereload_ and _HMR_ (hot module replacement) specific to that framework's tooling. 

## Use Dev Server with CLI

Using an existing dev server with the CLI is a 2-step process:

1. Start your framework-specific dev server as usual. For example:
   * Angular: `ng serve` - starts dev server on port 4200
   * Hugo: `hugo server` - starts dev server on port 1313

2. In a different terminal, run `swa start` with the URI provided by the dev server in step 1. This will typically be in the format `http://<host>:<port>`. For example:

**In Terminal 1:** Start the dev server (here, using Hugo)
```bash
$ hugo server 
...
...
Web Server is available at http://localhost:1313/ (bind address 127.0.0.1)
Press Ctrl+C to stop
```

**In Terminal 2:** Start the SWA CLI as follows.
```bash
$ swa start http://localhost:1313/

[swa] 
[swa] Using dev server for static content:
[swa]     http://localhost:1313/
[swa] 
[swa] 
[swa] This CLI is currently in preview and runs an emulator that may not match the 
[swa] cloud environment exactly. Always deploy and test your app in Azure.
[swa] 
[swa] 
[swa] Azure Static Web Apps emulator started at http://localhost:4280. Press CTRL+C to exit.
```

You can now visit `http://localhost:4280` on a browser to access the app with emulated SWA services.

## Default Ports

Here is a list of the default ports used by some popular dev servers:

| Tool                                                                               | Port | Command                           |
| ---------------------------------------------------------------------------------- | ---- | --------------------------------- |
| [Angular](https://angular.io/cli)                                                  | 4200 | `swa start http://localhost:4200` |
| [Blazor WebAssembly](https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor)     | 5000 | `swa start http://localhost:5000` |
| [Gatsby](https://www.gatsbyjs.com/docs/gatsby-cli/)                                | 8000 | `swa start http://localhost:8000` |
| [Hugo](https://gohugo.io/commands/hugo_server/)                                    | 1313 | `swa start http://localhost:1313` |
| [Next.js](https://nextjs.org/)                                                     | 3000 | `swa start http://localhost:3000` |
| [React (Create React App)](https://reactjs.org/docs/create-a-new-react-app.html)   | 3000 | `swa start http://localhost:3000` |
| [Svelte (sirv-cli)](https://github.com/lukeed/sirv/tree/master/packages/sirv-cli/) | 5000 | `swa start http://localhost:5000` |
| [Vue](https://cli.vuejs.org/)                                                      | 8080 | `swa start http://localhost:8080` |


## Unified Command

Instead of a 2-step (two terminal) process, you can simplify the workflow by providing the dev server startup command directly to the CLI along with the 

For example, the above 2-step process now becomes the single command shown below (output truncated for clarity).

```bash
$ swa start http://localhost:1313 --run "hugo server" 

[run] Start building sites ... 
[run] hugo v0.94.2+extended darwin/amd64 BuildDate=unknown
...
...
[run] Web Server is available at http://localhost:1313/ (bind address 127.0.0.1)
[run] Press Ctrl+C to stop
[swa] 
[swa] Using dev server for static content:
[swa]     http://localhost:1313
[swa] 
[swa] 
[swa] This CLI is currently in preview and runs an emulator that may not match the 
[swa] cloud environment exactly. Always deploy and test your app in Azure.
[swa] 
[swa] 
[swa] Azure Static Web Apps emulator started at http://localhost:4280. Press CTRL+C to exit.
[swa] 
```

As before, you can now visit `http://localhost:4280` on a browser to access the app with emulated SWA services.

## Dev Server Commands

For convenience, here are the unified commands that work for some popular frameworks (using their default dev server ports):

```bash
# npm start script (React)
swa start http://localhost:3000 --run "npm start"

# dotnet watch (Blazor)
swa start http://localhost:5000 --run "dotnet watch run"

# Jekyll
swa start http://localhost:4000 --run "jekyll serve"
```

You can also write your own custom startup script for execution and provide that along with the default URI that your custom dev server will run on:

```bash
# custom script
swa start http://localhost:4200 --run "./startup.sh"
```

As before, you can now visit `http://localhost:4280` on a browser to access the app with emulated SWA services.