export const apiFrameworks: FrameworkDefinition[] = [
  {
    id: "nodejs",
    name: "Node.js",
    files: ["package.json", "host.json"],
    config: {
      apiBuildCommand: "npm run build --if-present",
    },
  },
  {
    id: "typescript",
    name: "TypeScript",
    files: ["tsconfig.json"],
    packages: ["typescript"],
    parent: "nodejs",
    config: {
      // Final apiLocation will be API rootPath + apiLocation
      apiLocation: "{tsconfig.json#data.compilerOptions.outDir}",
    },
  },
  {
    id: "dotnet",
    name: ".NET",
    files: ["*.?(csproj|fsproj)", "host.json"],
    config: {
      apiBuildCommand: "dotnet publish -c Release",
    },
  },
  {
    id: "python",
    name: "Python",
    files: ["?(requirements.txt|pyproject.toml|runtime.txt|setup.py)", "host.json"],
    config: {
      // Nothing to setup, but we need to know the apiLocation (rootPath)
    },
  },
];

export const appFrameworks: FrameworkDefinition[] = [
  {
    id: "static",
    name: "Static HTML",
    config: {
      outputLocation: ".",
    },
    files: ["@(index.htm|default.htm)?(l)"],
  },
  {
    id: "angular",
    name: "Angular",
    files: ["angular.json"],
    packages: ["@angular/core"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:4200",
      outputLocation: "{angular.json#Object.values(data.projects)[0].architect.build.options.outputPath}",
    },
  },
  {
    id: "scully",
    name: "Scully",
    parent: "angular",
    packages: ["@scullyio/scully"],
    config: {
      // Same as base angular
    },
  },
  {
    id: "react",
    name: "React",
    packages: ["react", "react-dom"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "build",
    },
  },
  {
    id: "nextjs",
    name: "Next.js",
    parent: "react",
    packages: ["next"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm dev",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: ".",
    },
  },
  {
    id: "gatsby",
    name: "Gatsby",
    parent: "react",
    files: ["gatsby-config.js"],
    packages: ["gatsby"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:8000",
      outputLocation: "public",
    },
  },
  {
    id: "docusaurus",
    name: "Docusaurus",
    parent: "react",
    packages: ["@docusaurus/core"],
    config: {
      // Same as base react
    },
  },
  {
    id: "react-static",
    name: "React-static",
    parent: "react",
    packages: ["react-static"],
    config: {
      outputLocation: "dist",
    },
  },
  {
    id: "preact",
    name: "Preact",
    packages: ["preact"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "build",
    },
  },
  {
    id: "vue",
    name: "Vue.js",
    packages: ["vue"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run serve",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "dist",
    },
  },
  {
    id: "vite",
    name: "Vite",
    parent: "vue",
    packages: ["vite"],
    config: {
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:3000",
    },
  },
  {
    id: "nuxtjs",
    name: "Nuxt.js",
    parent: "vue",
    files: ["nuxt.config.js"],
    packages: ["nuxt"],
    config: {
      appBuildCommand: "npm run generate",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "dist",
    },
  },
  {
    id: "vuepress",
    name: "VuePress",
    overrides: ["vue"],
    packages: ["vuepress"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "src/.vuepress/dist",
    },
  },
  {
    id: "vitepress",
    name: "VitePress",
    overrides: ["vue"],
    packages: ["vitepress"],
    config: {
      appBuildCommand: "npm run docs:build",
      appDevserverCommand: "npm run docs:dev",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "docs/.vitepress/dist",
    },
  },
  {
    id: "svelte",
    name: "Svelte",
    packages: ["svelte"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "public",
    },
  },
  {
    id: "svelte-kit",
    name: "SvelteKit",
    overrides: ["svelte"],
    packages: ["@sveltejs/kit"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "build",
    },
  },
  {
    id: "sapper",
    name: "Sapper",
    overrides: ["svelte"],
    packages: ["sapper"],
    config: {
      appBuildCommand: "npm run export",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "__sapper__/export",
    },
  },
  {
    id: "riot",
    name: "Riot.js",
    packages: ["riot"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "dist",
    },
  },
  {
    id: "stencil",
    name: "Stencil.js",
    files: ["stencil.config.ts"],
    packages: ["@stencil/core"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:3333",
      outputLocation: "www",
    },
  },
  {
    id: "aurelia",
    name: "Aurelia",
    packages: ["aurelia-bootstrapper", "aurelia-cli"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "dist",
    },
  },
  {
    id: "ember",
    name: "Ember.js",
    packages: ["ember-cli", "ember-load-initializers", "ember-resolver"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:4200",
      outputLocation: "dist",
    },
  },
  {
    id: "elm",
    name: "Elm",
    files: ["elm.json"],
    config: {
      appBuildCommand: "elm make src/Main.elm --optimize",
      appDevserverCommand: "elm reactor",
      appDevserverUrl: "http://localhost:8000",
      outputLocation: ".",
    },
  },
  {
    id: "polymer",
    name: "Polymer",
    files: ["polymer.json"],
    packages: ["@polymer/polymer"],
    config: {
      appBuildCommand: "polymer build --preset es6-bundled",
      appDevserverCommand: "polymer serve --open",
      appDevserverUrl: "http://localhost:8081",
      outputLocation: "build/es6-bundled",
    },
  },
  {
    id: "lit",
    name: "Lit",
    packages: ["lit", "lit-element"],
    config: {
      appBuildCommand: "npm run build --if-present",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:8081",
      outputLocation: ".",
    },
  },
  {
    id: "hugo",
    name: "Hugo",
    files: ["config.toml", "content"],
    contains: {
      "config.toml": "baseURL =",
    },
    config: {
      appBuildCommand: "hugo -D",
      appDevserverCommand: "hugo server -D",
      appDevserverUrl: "http://localhost:1313",
      outputLocation: "public",
    },
  },
  {
    id: "flutter",
    name: "Flutter",
    files: ["pubspec.yaml", "web"],
    config: {
      appBuildCommand: "flutter build web",
      appDevserverCommand: "flutter run --web-port 8080",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "build/web",
    },
  },
  {
    id: "jekyll",
    name: "Jekyll",
    files: ["_config.yml", "Gemfile"],
    config: {
      appBuildCommand: "jekyll build",
      appDevserverCommand: "bundle exec jekyll serve --livereload",
      appDevserverUrl: "http://localhost:4000",
      outputLocation: "_site",
    },
  },
  {
    id: "slate",
    name: "Slate",
    overrides: ["middleman"],
    files: ["slate.sh", "Gemfile"],
    config: {
      appBuildCommand: "./slate.sh build",
      appDevserverCommand: "./slate.sh serve",
      appDevserverUrl: "http://localhost:4567",
      outputLocation: "build",
    },
  },
  {
    id: "mkdocs",
    name: "MkDocs",
    files: ["mkdocs.yml"],
    config: {
      appBuildCommand: "mkdocs build",
      appDevserverCommand: "mkdocs serve",
      appDevserverUrl: "http://localhost:8000",
      outputLocation: "site",
    },
  },
  {
    id: "eleventy",
    name: "Eleventy",
    packages: ["@11ty/eleventy"],
    config: {
      appBuildCommand: "eleventy",
      appDevserverCommand: "eleventy --serve",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "_site",
    },
  },
  {
    id: "astro",
    name: "Astro",
    overrides: ["alpine", "lit", "react", "preact", "solid", "svelte", "vue"],
    files: ["astro.config.mjs"],
    packages: ["astro"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "_site",
    },
  },
  {
    id: "pelican",
    name: "Pelican",
    files: ["pelicanconf.py"],
    config: {
      appBuildCommand: "make html",
      appDevserverCommand: "make devserver",
      appDevserverUrl: "http://localhost:8000",
      outputLocation: "output",
    },
  },
  {
    id: "hexo",
    name: "Hexo",
    packages: ["hexo"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run server",
      appDevserverUrl: "http://localhost:4000",
      outputLocation: "public",
    },
  },
  {
    id: "blazor-wasm",
    name: "Blazor WASM",
    files: ["*.csproj", "App.razor", "wwwroot", "Program.cs"],
    contains: {
      "Program.cs": "WebAssemblyHostBuilder.CreateDefault",
    },
    config: {
      appBuildCommand: "dotnet publish -c Release -o bin",
      appDevserverCommand: "dotnet watch run",
      appDevserverUrl: "http://localhost:8000",
      outputLocation: "bin/wwwroot",
    },
  },
  {
    id: "gridsome",
    name: "Gridsome",
    packages: ["gridsome"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run develop",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "dist",
    },
  },
  {
    id: "solid",
    name: "Solid",
    packages: ["solid-js"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "dist",
    },
  },
  {
    id: "remix",
    name: "Remix",
    overrides: ["react"],
    packages: ["@remix-run/node", "@remix-run/server-runtime"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm run dev",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "public/build",
    },
  },
  {
    id: "metalsmith",
    name: "Metalsmith",
    packages: ["metalsmith"],
    config: {
      appBuildCommand: "npm start",
      appDevserverCommand: "npm run serve",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "build",
    },
  },
  {
    id: "brunch",
    name: "Brunch",
    packages: ["brunch"],
    config: {
      appBuildCommand: "npm run build",
      appDevserverCommand: "npm start",
      appDevserverUrl: "http://localhost:3333",
      outputLocation: "public",
    },
  },
  {
    id: "wintersmith",
    name: "Wintersmith",
    files: ["config.json", "contents"],
    config: {
      appBuildCommand: "wintersmith build",
      appDevserverCommand: "wintersmith preview",
      appDevserverUrl: "http://localhost:8080",
      outputLocation: "build",
    },
  },
  {
    id: "middleman",
    name: "Middleman",
    files: ["config.rb", "Gemfile", "source"],
    config: {
      appBuildCommand: "bundle exec middleman build",
      appDevserverCommand: "bundle exec middleman server",
      appDevserverUrl: "http://localhost:4567",
      outputLocation: "build",
    },
  },
  {
    id: "mdbook",
    name: "mdBook",
    files: ["book.toml"],
    config: {
      appBuildCommand: "mdbook build",
      appDevserverCommand: "mdbook serve",
      appDevserverUrl: "http://localhost:3000",
      outputLocation: "book",
    },
  },
  {
    id: "zola",
    name: "Zola",
    files: ["config.toml", "content"],
    contains: {
      "config.toml": "base_url =",
    },
    config: {
      appBuildCommand: "zola build",
      appDevserverCommand: "zola serve",
      appDevserverUrl: "http://localhost:1111",
      outputLocation: "public",
    },
  },
  {
    id: "lektor",
    name: "Lektor",
    files: ["*.lektorproject"],
    config: {
      appBuildCommand: "lektor build --output-path dist",
      appDevserverCommand: "lektor server",
      appDevserverUrl: "http://localhost:5000",
      outputLocation: "dist",
    },
  },
];
