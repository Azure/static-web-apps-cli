const fs = require("fs");
const path = require("path");
const detect = require("./detect");

function findFolders(basePath) {
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function findSamples() {
  const folders = ["samples/api", "samples/app", "samples/ssr"];
  let allSamples = [];

  for (const folder of folders) {
    let samples = findFolders(path.join(__dirname, folder));
    samples = samples.map((sample) => path.join(__dirname, folder, sample));
    allSamples = [...allSamples, ...samples];
  }

  return allSamples;
}

function createTest(folderPath, name) {
  it(`should detect from root framework ${name}`, async () => {
    process.chdir(folderPath);

    let result = await detect(".");
    // Fix windows paths
    result = result.replace(/\\/g, "/");
    expect(result).toMatchSnapshot();
  });
}

describe("framework detection", () => {
  it("should detect frameworks", async () => {
    process.chdir(__dirname);

    let result = await detect("./samples", 2);
    // Fix windows paths
    result = result.replace(/\\/g, "/");
    expect(result).toMatchInlineSnapshot(`
      "Detected api folders (6):
      - samples/api/dotnet (.NET)
      - samples/api/dotnet-csx (.NET)
      - samples/api/dotnet-isolated (.NET)
      - samples/api/node (Node.js)
      - samples/api/node-ts (Node.js, TypeScript)
      - samples/api/python (Python)
      Detected app folders (56):
      - samples/app/angular (Angular)
      - samples/app/angular-scully (Angular, Scully)
      - samples/app/astro (Astro)
      - samples/app/astro-alpine (Astro)
      - samples/app/astro-lit (Astro)
      - samples/app/astro-multiple (Astro)
      - samples/app/astro-preact (Astro)
      - samples/app/astro-react (Astro)
      - samples/app/astro-solid (Astro)
      - samples/app/astro-svelte (Astro)
      - samples/app/astro-vue (Astro)
      - samples/app/aurelia (Aurelia)
      - samples/app/blazor-wasm (Blazor WASM)
      - samples/app/brunch (Brunch)
      - samples/app/capacitor/www (Static HTML)
      - samples/app/docsify (Static HTML)
      - samples/app/docusaurus (React, Docusaurus)
      - samples/app/eleventy (Eleventy)
      - samples/app/elm (Elm)
      - samples/app/ember (Ember.js)
      - samples/app/flutter (Flutter)
      - samples/app/gridsome (Gridsome)
      - samples/app/hexo (Hexo)
      - samples/app/hugo (Hugo)
      - samples/app/ionic-angular (Angular)
      - samples/app/ionic-react (React)
      - samples/app/ionic-vue (Vue.js)
      - samples/app/jekyll (Jekyll)
      - samples/app/lektor (Lektor)
      - samples/app/lit (Lit)
      - samples/app/mdbook (mdBook)
      - samples/app/metalsmith (Metalsmith)
      - samples/app/middleman (Middleman)
      - samples/app/mkdocs (MkDocs)
      - samples/app/nuxtjs (Vue.js, Nuxt.js)
      - samples/app/pelican (Pelican)
      - samples/app/polymer (Polymer)
      - samples/app/preact (Preact)
      - samples/app/react (React)
      - samples/app/react-static (React, React-static)
      - samples/app/riot (Riot.js)
      - samples/app/sapper (Sapper)
      - samples/app/slate (Slate)
      - samples/app/solid (Solid)
      - samples/app/static (Static HTML)
      - samples/app/stencil (Stencil.js)
      - samples/app/svelte (Svelte)
      - samples/app/svelte-kit (SvelteKit)
      - samples/app/vitepress (VitePress)
      - samples/app/vue (Vue.js, Vite)
      - samples/app/vuepress/docs (VuePress)
      - samples/app/wintersmith (Wintersmith)
      - samples/app/zola (Zola)
      - samples/ssr/angular-universal (Angular)
      - samples/ssr/nextjs (React, Next.js)
      - samples/ssr/remix (Remix)
      Undetected folders (3):
      - samples/ssr/blazor-server
      - samples/ssr/marko
      - samples/ssr/meteor"
    `);
  });

  findSamples().forEach((sample) => createTest(sample, path.basename(sample)));
});
