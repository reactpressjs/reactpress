import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';
import { resolveAlgoliaConfig } from './src/seo/algolia';
import { buildGlobalHeadTags, getSiteUrl } from './src/seo/headTags';
import { buildSiteMetadata } from './src/seo/metadata';
import { enhanceSitemapItems } from './src/seo/sitemap';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const siteUrl = getSiteUrl();
const algoliaConfig = resolveAlgoliaConfig();

const config: Config = {
  title: 'ReactPress',
  titleDelimiter: '-',
  tagline: 'Write with Focus. Publish with Joy.',
  // Default meta description for non-home pages (home overrides in src/pages/index.tsx)
  favicon: 'img/favicon.ico',

  // Production host is www (apex 301s → www). Override via DOCS_SITE_URL if needed.
  url: siteUrl,
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',
  // Match Cloudflare/Vercel redirects to `/path/` so crawled URL === canonical.
  trailingSlash: true,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'reactpressjs', // Usually your GitHub org/user name.
  projectName: 'reactpress', // Usually your repo name.

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  headTags: buildGlobalHeadTags(siteUrl),

  i18n: {
    defaultLocale: 'en',
    locales: ['zh', 'en'],
    localeConfigs: {
      en: {
        label: 'English',
        htmlLang: 'en',
      },
      zh: {
        label: '中文',
        htmlLang: 'zh-Hans',
      },
    },
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**', '/markdown-page', '/blog/rss.xml', '/blog/atom.xml', '**/tutorial-extras/help'],
          filename: 'sitemap.xml',
          createSitemapItems: async (params) => {
            const { defaultCreateSitemapItems, ...rest } = params;
            const items = await defaultCreateSitemapItems(rest);
            return enhanceSitemapItems(items, siteUrl);
          },
        },
        docs: {
          path: './tutorial',
          sidebarPath: './sidebars.ts',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          editUrl: ({ docPath, locale }) => {
            const branch = 'master';
            const base = `https://github.com/reactpressjs/reactpressjs/edit/${branch}`;
            if (locale === 'en') {
              return `${base}/docs/i18n/en/docusaurus-plugin-content-docs/current/${docPath}`;
            }
            return `${base}/docs/tutorial/${docPath}`;
          },
        },
        blog: {
          showReadingTime: true,
          blogTitle: 'Blog',
          blogDescription:
            'ReactPress blog — guides on self-hosted publishing with React: CMS, Next.js themes, plugins, desktop, and open-source updates. Release notes live under Changelog.',
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: ({ blogPath, locale }) => {
            const branch = 'master';
            const base = `https://github.com/reactpressjs/reactpressjs/edit/${branch}`;
            if (locale === 'zh') {
              return `${base}/docs/i18n/zh/docusaurus-plugin-content-blog/${blogPath}`;
            }
            return `${base}/docs/blog/${blogPath}`;
          },
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
          blogSidebarTitle: 'Blog',
        },
        theme: {
          customCss: [
            require.resolve('./src/css/customTheme.scss'),
            require.resolve('./src/css/index.scss'),
            require.resolve('./src/css/homepage.scss'),
            require.resolve('./src/css/showcase.scss'),
            require.resolve('./src/css/versions.scss'),
          ],
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: ['docusaurus-plugin-sass'],
  themeConfig: {
    // Replace with your project's social card
    image: 'img/reactpress-social-card.png',
    navbar: {
      title: 'ReactPress',
      logo: {
        alt: 'ReactPress Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'dropdown',
          label: 'Ecosystem',
          position: 'left',
          items: [
            { to: '/themes', label: 'Themes' },
            { to: '/plugins', label: 'Plugins' },
            { to: '/best-practices', label: 'Guides' },
          ],
        },
        {
          type: 'dropdown',
          label: 'Community',
          position: 'left',
          items: [
            {
              to: '/blog',
              label: 'Blog',
              // Exclude /blog/changelog so Blog and Changelog are not both active.
              activeBaseRegex: `/blog(?!/changelog(?:/|$))`,
            },
            {
              to: '/blog/changelog',
              label: 'Changelog',
              activeBasePath: '/blog/changelog',
            },
          ],
        },
        {
          type: 'dropdown',
          label: 'Resources',
          position: 'left',
          items: [
            { to: '/docs/tutorial-extras/desktop-client', label: 'Download' },
            { href: 'https://blog.gaoredu.com', label: 'Demo' },
          ],
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/reactpressjs/reactpressjs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Product',
          items: [
            {
              label: 'Documentation',
              to: '/docs/intro',
            },
            {
              label: 'Quick start',
              to: '/docs/getting-started/first-site',
            },
            {
              label: 'Download desktop',
              to: '/docs/tutorial-extras/desktop-client',
            },
            {
              label: 'Live demo',
              href: 'https://blog.gaoredu.com/',
            },
          ],
        },
        {
          title: 'Ecosystem',
          items: [
            {
              label: 'Themes',
              to: '/themes',
            },
            {
              label: 'Plugins',
              to: '/plugins',
            },
            {
              label: 'Best practices',
              to: '/best-practices',
            },
            {
              label: 'Theme development',
              to: '/docs/developer-guide/theme-development',
            },
            {
              label: 'Plugin development',
              to: '/docs/developer-guide/plugin-development',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/reactpressjs/reactpressjs/issues',
            },
            {
              label: 'GitHub Releases',
              href: 'https://github.com/reactpressjs/reactpressjs/releases',
            },
            {
              label: 'X',
              href: 'https://x.com/reactpre',
            },
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'Changelog',
              to: '/blog/changelog',
            },
          ],
        },
        {
          title: 'Legal & trust',
          items: [
            {
              label: 'About',
              to: '/about',
            },
            {
              label: 'FAQ',
              to: '/docs/reference/faq',
            },
            {
              label: 'Contact',
              to: '/contact',
            },
            {
              label: 'Privacy',
              to: '/privacy',
            },
            {
              label: 'Terms',
              to: '/terms',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/~reactpressjs',
            },
            {
              label: 'CLI package',
              href: 'https://www.npmjs.com/package/@reactpressjs/reactpress',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ReactPress.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },
    algolia: algoliaConfig,
    metadata: buildSiteMetadata(),
  } satisfies Preset.ThemeConfig,
};

export default config;
