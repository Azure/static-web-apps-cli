---
sidebar_position: 2
---
# Start the Emulator

## Using `swa`

 * Open a Static Web Apps folder at the root (outside any /api or /app folders). 
 * Start the emulator in that directory using `swa`. 
 * Open a browser to `http://localhost:4280` to access the SWA

```bash
$ cd my-awesome-swa-app
$ swa start ./
```


## Using `npx`


 * Open a Static Web Apps folder at the root (outside any /api or /app folders). 
 * Start the emulator using the `npx` command below.
 * Open a browser to `http://localhost:4280` to access the SWA

```
$ cd my-awesome-swa-app
$ npx @azure/static-web-apps-cli start
```
