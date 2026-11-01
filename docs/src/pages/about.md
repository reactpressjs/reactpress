---
title: About ReactPress
description: >-
  About ReactPress — Write with Focus. Publish with Joy. A self-hosted publishing
  platform to write, manage, and publish in one place. Open-source CMS with themes and plugins.
keywords: [reactpress, about, open source, self-hosted publishing, react cms]
---

# About ReactPress

**Write with Focus. Publish with Joy.**

**ReactPress** is a **self-hosted publishing platform** to write, manage, and publish — all in one place. The core product is **ReactPress CMS**; plugins, themes, templates, and components expand what you can ship. Long-term we are building an open ecosystem for modern publishers — while keeping the product focused and usable today.

## Positioning

| Item         | Definition                                                           |
| ------------ | -------------------------------------------------------------------- |
| Brand        | ReactPress                                                           |
| Domain       | [reactpress.cc](https://www.reactpress.cc/)                          |
| Category     | Self-hosted publishing platform                                      |
| Core users   | Creators, React developers, indie builders, site owners              |
| Core product | ReactPress CMS                                                       |
| Slogan       | **Write with Focus. Publish with Joy.**                              |
| Mission      | Make writing, managing, and publishing websites simple — self-hosted |

## What we build

| Layer   | Technology                | Purpose                                     |
| ------- | ------------------------- | ------------------------------------------- |
| CLI     | `@fecommunity/reactpress` | `init`, `doctor`, `logs`, `stop`            |
| API     | NestJS + SQLite / MySQL   | Headless REST, webhooks, API keys           |
| Admin   | Vite + React              | Content, media, themes, plugins             |
| Theme   | Next.js (SSR)             | Visitor site with SEO, sitemap, OG tags     |
| Desktop | Electron                  | Offline writing with SQLite local mode      |
| Plugins | Hook + `plugin.json`      | SEO, auto-summary, WebP optimization, slots |

ReactPress 4.0 (codename **Extend**) is the current recommended release:

```bash
npm i -g @fecommunity/reactpress
```

## Platform model

```text
WRITE · MANAGE · PUBLISH

ReactPress CMS     → writing, content, publish
Plugins / Themes   → extend and customize
Templates / Components → accelerate delivery
Marketplace (later) → discover, install, trade extensions
```

We are **not** positioning ReactPress as “WordPress rewritten in React.” The difference is a **focused publishing workflow** on a modern JavaScript stack.

## Who ReactPress is for

- **Writers & site owners** who want a focused editor and self-hosted control
- **React developers** who want one stack to build and operate websites
- **Indie builders** who need CMS + theme + CLI without assembling five tools
- **Teams evaluating modern CMS options** — see [ReactPress vs WordPress](/docs/getting-started/reactpress-vs-wordpress)
- **Self-hosters** — see [Self-hosted CMS for React](/docs/getting-started/self-hosted-cms-for-react)

## Open source & license

ReactPress is developed by [fecommunity](https://github.com/fecommunity) and released under the **MIT License**. Source, issues, and contributions live on [GitHub](https://github.com/fecommunity/reactpress).

## Live demo & hubs

- [Live demo](https://blog.gaoredu.com/) — production site powered by ReactPress
- [Themes](/themes) · [Plugins](/plugins) · [Best practices](/best-practices)
- [Documentation](/docs/intro) · [Changelog](/blog/changelog)
- [npm package](https://www.npmjs.com/package/@fecommunity/reactpress)

## Contact

Questions, security reports, or partnership inquiries: [Contact us](/contact) or email [admin@gaoredu.com](mailto:admin@gaoredu.com).

## Related pages

- [What is ReactPress?](/docs/getting-started/what-is-reactpress)
- [Build a Next.js blog in 60 seconds](/docs/getting-started/build-nextjs-blog-in-60-seconds)
- [ReactPress vs WordPress](/docs/getting-started/reactpress-vs-wordpress)
- [Self-hosted CMS for React](/docs/getting-started/self-hosted-cms-for-react)
- [Blog](/blog)
- [FAQ](/docs/reference/faq)
- [Privacy Policy](/privacy)
- [Terms of Use](/terms)
