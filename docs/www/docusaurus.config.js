// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");
const child_process = require("child_process");

function getBuildId() {
  let branch = "";
  let hash = "";
  let build = "DEV";
  try {
    branch = child_process.execSync(`git rev-parse --abbrev-ref HEAD`).toString("utf-8").trim();
    hash = child_process.execSync(`git rev-parse --short HEAD`).toString("utf-8").trim();
    build = `<a rel="noopener noreferrer" target="_blank" href="https://github.com/Azure/static-web-apps-cli/commit/${hash}">${branch}+sha.${hash}</a>`;
  } catch {}
  return build;
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Static Web Apps CLI",
  tagline: "All-in-One Local Development Tool For Azure Static Web Apps",
  onBrokenLinks: "error",
  favicon: "img/favicon.ico",

  url: "https://azure.github.io",
  baseUrl: "/static-web-apps-cli/", //  Needs to be "/" if deploying to SWA
  organizationName: "azure",
  projectName: "static-web-apps-cli",
  deploymentBranch: `gh-pages`,

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/azure/static-web-apps-cli/tree/main/docs/www/",
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "SWA CLI",
        logo: {
          alt: "SWA CLI Logo",
          src: "img/swa-cli-logos/swa-cli-logo.svg",
        },
        items: [
          {
            type: "doc",
            docId: "use/install",
            position: "left",
            label: "Get Started",
          },
          {
            type: "doc",
            docId: "intro",
            position: "left",
            label: "About",
          },
          {
            type: "doc",
            docId: "cli/swa",
            position: "left",
            label: "Docs",
          },
          {
            type: "doc",
            docId: "contribute/intro",
            position: "left",
            label: "Contribute",
          },
          { to: "https://stackoverflow.com/questions/tagged/swa-cli", label: "StackOverflow", position: "left" },
          {
            href: "https://github.com/Azure/static-web-apps-cli",
            position: "right",
            className: "header-github-link",
            "aria-label": "GitHub repository",
          },
        ],
      },
      footer: {
        style: "dark",
        copyright: `Copyright © ${new Date().getFullYear()} Microsoft | Built with Docusaurus and Iconcloud.design <br>build: ${getBuildId()}`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },

      announcementBar: {
        id: "Landing Page Banner",
        content:
          'If you like SWA CLI, give it a star on <a target="_blank" rel="noopener noreferrer" href="https://github.com/Azure/static-web-apps-cli/stargazers">GitHub</a> and follow us on <a target="_blank" rel="noopener noreferrer" href="https://twitter.com/AzureStaticApps">Twitter</a>',
        backgroundColor: "#cc4fc2",
        textColor: "#FFFFFF",
        isCloseable: false,
      },
    }),
};

module.exports = config;
