import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'en-US',
  title: 'NX Bun',
  description: 'Bringing both NX and Bun together',
  outDir: '../dist/docs',
  base: '/nx-bun/',

  themeConfig: {
    siteTitle: 'NX Bun',
    nav: nav(),

    sidebar: {
      '/guide/': sideNavGuide(),
      '/docs/': sideNavDocs(),
    },

    footer: {
      message:
        'MIT Licensed | Copyright © 2023-present NX Bun Developers & Contributors',
    },
  },
});

function nav() {
  return [
    { text: 'Guide', link: '/guide/' },
    { text: 'Docs', link: '/docs/nx-bun/overview' },
    {
      text: 'Links',
      items: [
        {
          text: 'Twitter',
          link: 'https://twitter.com/JordanHall_dev',
        },
        {
          text: 'Github',
          link: 'https://github.com/jordan-hall/nx-bun',
        },
      ],
    },
  ];
}

function sideNavGuide() {
  return [
    {
      text: 'Guide',
      items: [
        {
          text: 'Getting Started',
          link: '/guide/',
        }
      ],
    },
  ];
}

function sideNavDocs() {
  return [
    {
      text: 'The Repo',
      collapsible: true,
      items: [
        {
          text: 'Overview',
          link: '/docs/repo/overview',
        },
        {
          text: 'Contributing',
          link: '/docs/repo/contributing',
        },
      ],
    },
    {
      text: 'nx bun',
      collapsible: true,
      collapsed: true,
      items: [
        {
          text: 'Using Bun',
          items: [
            {
              text: 'Overview',
              link: '/docs/bun/overview',
            },
            {
              text: 'Installation',
              link: '/docs/bun/installation',
            },
            {
              text: 'Generators',
              link: '/docs/bun/generators',
            },
            {
              text: 'Executors',
              link: '/docs/bun/executors',
            },
          ],
        },
      ],
    },
    {
      text: 'NX Task Runner (worker)',
      collapsible: true,
      collapsed: true,
      items: [
        {
          text: 'Task Runner (Workers)',
          items: [
            {
              text: 'Overview',
              link: '/docs/task-worker-runner/overview',
            },
            {
              text: 'Installation',
              link: '/docs/task-worker-runner/installation',
            }
          ],
        },
      ],
    },
  ];
}
