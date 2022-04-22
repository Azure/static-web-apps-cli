export const apiFrameworks: FrameworkDefinition[] = [
  {
    id: "nodejs",
    name: "Node.js",
    files: ["package.json", "host.json"],
    config: {
      apiBuildCommand: "npm run build --if-present",
    }
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
      apiBuildCommand: "dotnet build",
    }
  },
  {
    id: "python",
    name: "Python",
    files: ["?(requirements.txt|pyproject.toml|runtime.txt|setup.py)", "host.json"],
    config: {
      // Nothing to setup, but we need to know the apiLocation (rootPath)
    }
  }
];

export const appFrameworks: FrameworkDefinition[] = [
  {
    id: "static",
    name: "Static HTML",
    config: {
      outputLocation: "./",
    },
    files: ["@(index.htm|default.htm)?(l)"]
  },
  {
    id: "angular",
    name: "Angular",
    files: ["angular.json"],
    packages: ["@angular/core"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:4200",
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
    }
  },
  {
    id: "react",
    name: "React",
    packages: ["react", "react-dom"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:3000",
      outputLocation: "build",
    }
  },
  {
    id: "nextjs",
    name: "Next.js",
    parent: "react",
    packages: ["next"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm dev",
      devServerUrl: "http://localhost:3000",
      outputLocation: "./"
    }
  },
  {
    id: "gatsby",
    name: "Gatsby",
    parent: "react",
    files: ["gatsby-config.js"],
    packages: ["gatsby"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:8000",
      outputLocation: "public"
    }
  },
  {
    id: "docusaurus",
    name: "Docusaurus",
    parent: "react",
    packages: ["@docusaurus/core"],
    config: {
      // Same as base react
    }
  },
  {
    id: "react-static",
    name: "React-static",
    parent: "react",
    packages: ["react-static"],
    config: {
      outputLocation: "dist"
    }
  },
  {
    id: "preact",
    name: "Preact",
    packages: ["preact"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:8080",
      outputLocation: "build"
    }
  },
  {
    id: "vue",
    name: "Vue.js",
    packages: ["vue"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run serve",
      devServerUrl: "http://localhost:8080",
      outputLocation: "dist",
    }
  },
  {
    id: "vite",
    name: "Vite",
    parent: "vue",
    packages: ["vite"],
    config: {
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:3000",
    }
  },
  {
    id: "nuxtjs",
    name: "Nuxt.js",
    parent: "vue",
    files: ["nuxt.config.js"],
    packages: ["nuxt"],
    config: {
      appBuildCommand: "npm run generate",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:3000",
      outputLocation: "dist",
    }
  },
  {
    id: "vuepress",
    name: "VuePress",
    preempt: ["vue"],
    packages: ["vuepress"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:8080",
      outputLocation: "src/.vuepress/dist"
    }
  },
  {
    id: "vitepress",
    name: "vitepress",
    preempt: ["vue"],
    packages: ["vitepress"],
    config: {
      appBuildCommand: "npm run docs:build",
      devServerCommand: "npm run docs:dev",
      devServerUrl: "http://localhost:3000",
      outputLocation: "docs/.vitepress/dist",
    }
  },
  {
    id: "svelte",
    name: "Svelte",
    packages: ["svelte"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:8080",
      outputLocation: "public"
    }
  },
  {
    id: "svelte-kit",
    name: "SvelteKit",
    preempt: ["svelte"],
    packages: ["@sveltejs/kit"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:8080",
      outputLocation: "build"
    }
  },
  {
    id: "sapper",
    name: "Sapper",
    preempt: ["svelte"],
    packages: ["sapper"],
    config: {
      appBuildCommand: "npm run export",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:3000",
      outputLocation: "__sapper__/export"
    }
  },
  {
    id: "riot",
    name: "Riot.js",
    packages: ["riot"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:3000",
      outputLocation: "dist"
    }
  },
  {
    id: "stencil",
    name: "Stencil.js",
    files: ["stencil.config.ts"],
    packages: ["@stencil/core"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:3333",
      outputLocation: "www"
    }
  },
  {
    id: "aurelia",
    name: "Aurelia",
    packages: ["aurelia-bootstrapper", "aurelia-cli"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:8080",
      outputLocation: "dist"
    }
  },
  {
    id: "ember",
    name: "Ember.js",
    packages: ["ember-cli"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:4200",
      outputLocation: "dist"
    }
  },
  {
    id: "elm",
    name: "Elm",
    files: ["elm.json"],
    config: {
      appBuildCommand: "elm make src/Main.elm --optimize",
      devServerCommand: "elm reactor",
      devServerUrl: "http://localhost:8000",
      outputLocation: "./"
    }
  },
  {
    id: "polymer",
    name: "Polymer",
    files: ["polymer.json"],
    packages: ["@polymer/polymer"],
    config: {
      appBuildCommand: "polymer build --preset es6-bundled",
      devServerCommand: "polymer serve --open",
      devServerUrl: "http://localhost:8081",
      outputLocation: "build/es6-bundled"

    }
  },
  {
    id: "lit",
    name: "Lit",
    packages: ["lit", "lit-element"],
    config: {
      appBuildCommand: "npm run build --if-present",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:8081",
      outputLocation: "./"
    }
  },
  {
    id: "hugo",
    name: "Hugo",
    files: ["content", "config.toml"],
    config: {
      appBuildCommand: "hugo -D",
      devServerCommand: "hugo server -D",
      devServerUrl: "http://localhost:1313",
      outputLocation: "public"
    }
  },
  {
    id: "flutter",
    name: "Flutter",
    files: ["pubspec.yaml", "flutterapp.iml"],
    config: {
      appBuildCommand: "flutter build web",
      devServerCommand: "flutter run --web-port 8080",
      devServerUrl: "http://localhost:8080",
      outputLocation: "build/web",
    }
  },
  {
    id: "jekyll",
    name: "Jekyll",
    files: ["_config.yml", "Gemfile"],
    config: {
      appBuildCommand: "jekyll build",
      devServerCommand: "bundle exec jekyll serve --livereload",
      devServerUrl: "http://localhost:4000",
      outputLocation: "_site",
    }
  },
  {
    id: "slate",
    name: "Slate",
    files: ["slate.sh", "Gemfile"],
    config: {
      appBuildCommand: "./slate.sh build",
      devServerCommand: "./slate.sh serve",
      devServerUrl: "http://localhost:4567",
      outputLocation: "build",
    }
  },
  {
    id: "mkdocs",
    name: "MkDocs",
    files: ["mkdocs.yml"],
    config: {
      appBuildCommand: "mkdocs build",
      devServerCommand: "mkdocs serve",
      devServerUrl: "http://localhost:8000",
      outputLocation: "site",
    }
  },
  {
    id: "eleventy",
    name: "Eleventy",
    packages: ["@11ty/eleventy"],
    config: {
      appBuildCommand: "eleventy",
      devServerCommand: "eleventy --serve",
      devServerUrl: "http://localhost:8080",
      outputLocation: "_site",
    }
  },
  {
    id: "astro",
    name: "Astro",
    preempt: ["alpine", "lit", "react", "preact", "solid", "svelte", "vue"],
    files: ["astro.config.mjs"],
    packages: ["astro"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:8080",
      outputLocation: "_site",
    }
  },
  {
    id: "pelican",
    name: "Pelican",
    files: ["pelicanconf.py"],
    config: {
      appBuildCommand: "make html",
      devServerCommand: "make devserver",
      devServerUrl: "http://localhost:8000",
      outputLocation: "output",
    }
  },
  {
    id: "hexo",
    name: "Hexo",
    packages: ["hexo"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run server",
      devServerUrl: "http://localhost:4000",
      outputLocation: "public",
    }
  },
  {
    id: "blazor-wasm",
    name: "Blazor WASM",
    files: ["*.csproj", "App.razor", "wwwroot", "Program.cs"],
    // TODO: add a way to detect if program.cs is specifically blazor wasm
    // (uses BlazorApp.Client), otherwise any ASP.net project will be detected as blazor
    config: {
      appBuildCommand: "dotnet build",
      devServerCommand: "dotnet watch run",
      devServerUrl: "http://localhost:8000",
      outputLocation: "output",
    }
  },
  {
    id: "gridsome",
    name: "Gridsome",
    packages: ["gridsome"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run develop",
      devServerUrl: "http://localhost:8080",
      outputLocation: "dist",
    }
  },
  {
    id: "solid",
    name: "Solid",
    packages: ["solid-js"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:3000",
      outputLocation: "dist",
    }
  },
  {
    id: "remix",
    name: "Remix",
    preempt: ["react"],
    packages: ["@remix-run/node", "@remix-run/serve"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm run dev",
      devServerUrl: "http://localhost:3000",
      outputLocation: "public/build",
    }
  },
  {
    id: "metalsmith",
    name: "Metalsmith",
    packages: ["metalsmith"],
    config: {
      appBuildCommand: "npm start",
      devServerCommand: "npm run serve",
      devServerUrl: "http://localhost:3000",
      outputLocation: "build",
    }
  },
  {
    id: "brunch",
    name: "Brunch",
    packages: ["brunch"],
    config: {
      appBuildCommand: "npm run build",
      devServerCommand: "npm start",
      devServerUrl: "http://localhost:3333",
      outputLocation: "public",
    }
  },
  {
    id: "wintersmith",
    name: "Wintersmith",
    files: ["config.json", "contents"],
    config: {
      appBuildCommand: "wintersmith build",
      devServerCommand: "wintersmith preview",
      devServerUrl: "http://localhost:8080",
      outputLocation: "build",
    }
  },
  {
    id: "middleman",
    name: "middleman",
    files: ["config.rb", "Gemfile", "source"],
    config: {
      appBuildCommand: "bundle exec middleman build",
      devServerCommand: "bundle exec middleman server",
      devServerUrl: "http://localhost:4567",
      outputLocation: "build",
    }
  },
];
