# Website

This website is built using [Docusaurus 2](https://docusaurus.io/), a modern static website generator. This README has been modified to reflect the setup process for this specific project.

---

### 1. Installation

Run the following command in root of repository to scaffold source in `docs/www`.
 
```bash
$ npx create-docusaurus@latest docs/www classic
Need to install the following packages:
  create-docusaurus@latest
Ok to proceed? (y) 
[INFO] Creating new Docusaurus project...
[INFO] Installing dependencies with npm...
...
...
[SUCCESS] Created docs/www.
```

### 2. Build For Preview

Start the development server locally. This opens a browser window and provides hot reload for dynamic preview of code changes without explicitly restarting server.

```bash
$ cd docs/www
$ npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### 3. Build For Production

Build your website into static files for deployment in production. Use the `serve` command to preview this static build on a local webserver.

```
$ cd docs/www
$ npm run build
$ npm run serve
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### 4. Deploy to GitHub Pages

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch. 

```bash
$ cd docs/www
$ npm deploy
```
Before you do that, make sure the `docusaurus.config.js` is setup correctly using [this guidance](https://docusaurus.io/docs/deployment#github-pages-overview). Look for the _`// Please change this to your repo`_ comments and update those to reflect the local repo.

Note that when using `npm run deploy` from the commandline (e.g., for initial testing), you need to set the `GIT_USER` and `GIT_PASS` environment variables to 


### 5. Customize site content.

Docusaurus content is generated under this structure:

 * `blog/` - posts with index page, tags, RSS feed.
 * `docs/` - tutorials with sidebar, prev/next navigation
 * `src/pages` - standalone pages (map directly to routes)
 * `static/` - static assets (served as is)

Main configuration files are:
 * `docusaurus.config.js` - all site configuration
 * `package.json` - NPM dependencies for build
 * `sidebars.js` - explicitly specify sidebar contents

Logo theme colors are (light to dark)
 * #ff9cfd
 * #F131F8
 * #b319a6