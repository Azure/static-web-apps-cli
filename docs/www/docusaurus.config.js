// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Static Web Apps CLI",
  tagline: "A Local Development Tool For Azure Static Web Apps",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",

  /* PICK A VERSION FROM STAGING vs. PRODUCTION */
  url: "https://azure.github.io",
  baseUrl: "/static-web-apps-cli/", //  Needs to be "/" if deploying to SWA
  organizationName: "azure",
  projectName: "static-web-apps-cli",
  deploymentBranch: `gh-pages`,

  /* -- USE FOR STAGING VERSION (@nitya)
  url: 'https://nitya.github.io',
  baseUrl: '/swa-cli-docs/',
  organizationName: 'nitya',
  projectName: 'swa-cli-docs',
  deploymentBranch: `gh-pages`,
  */

  /* -- USE FOR PRODUCTION VERSION (@azure)
  url: 'https://azure.github.io',
  baseUrl: '/static-web-apps-cli/',
  organizationName: 'azure',
  projectName: 'static-web-apps-cli',
  deploymentBranch: `gh-pages`,
  */

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          editUrl: "https://github.com/azure/static-web-apps-cli/tree/main/docs/www/",
        },
        blog: false,
        /**
        blog: {
          blogTitle: 'What\'s New in SWA CLI!',
          blogDescription: 'Release notes and announcements from the Azure Static Web Apps CLI team',
          postsPerPage: 3,
          blogSidebarTitle: 'Recent Posts',
          blogSidebarCount: 'ALL',
          showReadingTime: true,
          feedOptions: {
            type: 'rss',
            copyright: `Copyright © ${new Date().getFullYear()} Microsoft Developer Relations`,
          },
          // Please change this to your repo.
          editUrl:
            'https://github.com/azure/static-web-apps-cli/tree/main/docs/www/',
        },
        */
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
          src: "img/logo.svg",
        },
        items: [
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
            label: "CLI",
          },
          {
            type: "doc",
            docId: "use/install",
            position: "left",
            label: "Get Started",
          },
          {
            type: "doc",
            docId: "contribute/intro",
            position: "left",
            label: "Contribute",
          },
          /*{to: '/blog', label: 'Blog', position: 'right'},*/
          { to: "https://github.com/Azure/static-web-apps-cli/discussions", label: "Discussions", position: "right" },
          { to: "https://stackoverflow.com/questions/tagged/swa-cli", label: "StackOverflow", position: "right" },
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
        /*
        links: [
          {
            title: 'Static Web Apps',
            items: [
              {
                label: 'Documentation',
                to: 'https://docs.microsoft.com/en-us/azure/static-web-apps/overview',
              },
              {
                label: 'Learning Path',
                to: 'https://docs.microsoft.com/en-us/learn/paths/azure-static-web-apps/',
              },
              {
                label: 'Video: Tips & Tricks',
                to: 'https://www.youtube.com/playlist?list=PLlrxD0HtieHgMPeBaDQFx9yNuFxx6S1VG',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Twitter',
                href: 'https://twitter.com/AzureStaticApps',
              },
              {
                label: 'Dev.to',
                href: 'https://dev.to/t/staticwebapps',
              },
              {
                label: 'TechCommunity',
                href: 'https://techcommunity.microsoft.com/t5/forums/searchpage/tab/message?q=Static%20web%20Apps',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub / SWA CLI',
                to: 'https://github.com/Azure/static-web-apps-cli',
              },
              {
                label: 'GitHub / Samples Gallery',
                href: 'https://github.com/microsoft/static-web-apps-gallery-code-samples',
              },
              {
                label: 'GitHub / SWA Templates',
                href: 'https://github.com/staticwebdev',
              },
            ],
          },
        ],
        */
        copyright: `Copyright © ${new Date().getFullYear()} Microsoft | Built with Docusaurus and Iconcloud.design.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },

      announcementBar: {
        id: "Landing Page Banner",
        content:
          '<b> If you find SWA CLI useful <a href="https://github.com/Azure/static-web-apps-cli/stargazers"> do give us a ⭐️  on GitHub</a> - we apprecite your support! </a></b>',
        backgroundColor: "#F50057",
        textColor: "#FFFFFF",
        isCloseable: false,
      },
    }),
};

module.exports = config;
