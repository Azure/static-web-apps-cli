---
sidebar_position: 3
---

# Get CLI Help


## CLI Commands Help
 
Use `swa help` or `swa --help` for more details

```bash
$ swa --help
```

The output should look something like this

```bash

Usage: swa <command> [options]

Options:
  -v, --version         output the version number
  --verbose [prefix]    enable verbose output. 
                        Values are: 
                        silly,info,log,silent (default: "log")
  --config <path>       Path to swa-cli.config.json file to use.    
                        (default: "swa-cli.config.json")
  --print-config        Print all resolved options. 
                        (default: false)
  -h, --help            display help for command

Commands:
  start [options] [context]  start the emulator from a directory
                             or bind to a dev server
  help [command]             display help for command

Documentation:
  https://aka.ms/swa/cli-local-development
```

## Command-Specific Help

Add `--help` to any command to get more details on its usage. Here's an example:

```bash
$ swa start --help
```

You should see something like this. The examples at the end showcase the more popular uses for this command.

```bash

Usage: swa start [context] [options]

start the emulator from a directory or bind to a dev server

Options:
  --app-location <appLocation>               set location for the static app source code (default: "./")
  --api-location <apiLocation>               set the API folder or Azure Functions emulator address
  --swa-config-location <swaConfigLocation>  set the directory where the staticwebapp.config.json file is located (default: "./")
  --api-port <apiPort>                       set the API backend port (default: 7071)
  --host <host>                              set the cli host address (default: "localhost")
  --port <port>                              set the cli port (default: 4280)
  --ssl                                      serve the app and API over HTTPS (default: false)
  --ssl-cert <sslCertLocation>               SSL certificate (.crt) to use for serving HTTPS
  --ssl-key <sslKeyLocation>                 SSL key (.key) to use for serving HTTPS
  --run <startupScript>                      run a command at startup
  --devserver-timeout <devserverTimeout>     time to wait (in ms) for the dev server to start (default: 30000)
  --open                                     open the browser to the dev server (default: false)
  --func-args <funcArgs>                     pass additional arguments to the func start command
  -h, --help                                 display help for command

Examples:

  Serve static content from a specific folder
  swa start ./output-folder

  Use an already running framework development server
  swa start http://localhost:3000

  Use staticwebapp.config.json file in a specific location
  swa start http://localhost:3000 --swa-config-location ./app-source

  Serve static content and run an API from another folder
  swa start ./output-folder --api-location ./api

  Use a custom command to run framework development server at startup
  swa start http://localhost:3000 --run "npm start"
```