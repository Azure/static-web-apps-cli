---
sidebar_position: 3
---

# 2. Start the Emulator

The SWA Emulator is run by using the `swa start` command.

- It runs on `http://localhost:4280` by default.
- Read the [swa start](../cli/swa-start) documentation for more command details.

## 2.1 Serve from the current folder

By default, the CLI starts and serves any the static content from the current working directory:

```bash
swa start
```

## 2.2 Serve from a specified folder

You can override the behavior to start the emulator with a different static assets folder. For instance, if your application artifacts are in `./my-dist` then use:

```bash
swa start ./my-dist
```

## 2.3 Serve from dev server

When developing your SWA front-end, you may want to use the front-end framework's default dev server (started using its CLI) to get benefits like live reload and hot module replacement (HMR). <br/> **For Example:** Angular devs may use `ng serve` or `npm start` to run that dev server. <br/>

SWA CLI can reverse proxy requests to that dev server, allowing you to retain the above benefits during the local development of your SWA. You can achieve this in two steps:

1.  Start the local dev server as usual. _Note the URL (localhost:port) the dev server runs on._
2.  Start the SWA CLI in a new terminal _with the dev server URL specified._

```bash
swa start <dev-server-url>
```

## 2.4 Launch dev server to serve

You can simplify your workflow further by having the SWA CLI launch the dev server for you. Simply pass the launch command for the dev server to the `--run` option of `swa start`.

```bash
swa start <dev-server-url> --run <dev-server-launch-cmd>
```

**For example:**
Here is what that lools like for a few well-known front-end technologies:

```bash
# npm start script (React)
swa start http://localhost:3000 --run "npm start"

# dotnet watch (Blazor)
swa start http://localhost:5000 --run "dotnet watch run"

# Jekyll
swa start http://localhost:4000 --run "jekyll serve"
```

Have a custom script that launches the dev server for you? That works too:

```bash
# custom script
swa start http://localhost:4200 --run "./startup.sh"
```

Then access the application with the emulated services from `http://localhost:4280`

## 2.5 Default Dev Server ports

Here are some of the default ports used by dev servers in popular front-end frameworks and static site generators today.

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
