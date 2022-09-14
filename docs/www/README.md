# Website Development

This website is built using [Docusaurus 2](https://docusaurus.io/), a modern static website generator. This README documents the process for creating and updating the site for **this** project.

---

## 1. Site Creation

The documentation source was scaffolded in the `docs/www` directory using the default _classic_ theme.

```bash
$ npx create-docusaurus@latest docs/www classic
```

## 2. Site Development

Start the development server - this has built-in hot reload so you can preview changes to the site as you make them. The command should launch the preview in your browser (served by default at `http://localhost:3000/static-web-apps-cli/`)

```bash
$ cd docs/www
$ npm start
```

## 3. Production Build

Build the website for production - by default this creates the static content in `build/`, which can now be deployed to a relevant hosting service (like GitHub Pages or Azure Static Web Apps) for public access.

```bash
$ cd docs/www
$ npm run build
```

You can preview the local build version using this command:

```bash
$ npm run serve
```

## 4. Deploy: GitHub Pages

Docusaurus provides [this guidance](https://docusaurus.io/docs/deployment#github-pages-overview) to simplify deployment to GitHub pages in two steps.

First, update the `docusaurus.config.js` file with the settings for the project repository name, owner and branch. Here is the default configuration used for this project:

```javascript
  url: 'https://azure.github.io',
  baseUrl: '/static-web-apps-cli/',
  organizationName: 'azure',
  projectName: 'static-web-apps-cli',
  deploymentBranch: `gh-pages`,
```

Next use `npm deploy` or `yarn deploy` to push the built site to the GitHub pages endpoint. This will setup the deployment branch (`gh-pages`) if it was not previously created.

```bash
$ cd docs/www
$ npm deploy
```

Before you do that, make sure the `docusaurus.config.js` is setup correctly using [this guidance](https://docusaurus.io/docs/deployment#github-pages-overview). Look for the _`// Please change this to your repo`_ comments and update those to reflect the local repo.

Note that when using `npm run deploy` from the commandline (e.g., for initial testing), you need to set the `GIT_USER` and `GIT_PASS` environment variables to

## 5. Deploy: Azure Static Web Apps

// TODO: Fill in details for deploying same source to SWA
// Site: https://azurestaticwebapps.dev/

## 6. Content Structure

> Docusaurus has this default structure for content:

- `blog/` - posts with index page, tags, RSS feed.
- `docs/` - tutorials with sidebar, prev/next navigation
- `src/pages` - standalone pages (map directly to routes)
- `static/` - static assets (served as is)

> These are the main configuration files:

- `docusaurus.config.js` - all site configuration
- `package.json` - NPM dependencies for build
- `sidebars.js` - explicitly specify sidebar contents

> These are the key files to customize this site:

1.  `docusaurus.config.js`
    - update contents of navbar
    - update contents of footer
    - identify and customize plugins
    - activate or deactivate default features (e.g., blog)
    - activate and customize banner (top of landing page)
2.  `src/components/HomepageFeatures/index.js`
    - customize landing page body (features grid)
3.  `src/components/index.js`
    - customize landing page structure (layout)
4.  `src/css/custom.css`
    - customize theme palette (dark, light)
    - implement sitewide css changes

> Guidelines for adding new content

- Blog feature is **deactivated**. (Update `docusaurus.config.js` to reactivate)
- Have **step-by-step** instructions?
  - Add file under `docs/`X/Y for tutorial X with steps Y
  - Create `docs/`X/_category_.json to define placement, metadata
- Have **single-page** documents that standalone?
  - Add file as `src/pages/`X.md
  - Choose X to reflect the desired _route_ name for this page

## 6. Color Palette

> Old Color Palette (v0.8.3)

- #ff9cfd
- #F131F8
- #b319a6
  > New Color Palette (GA)
- A100 (light) = #FF80AB
- A200 (medium) = #FF4081
- A400 (dark) = #F50057
