---
sidebar_position: 1
id: intro
title: Introduction
description: >-
  Official ReactPress docs — a self-hosted publishing platform to write, manage,
  and publish in one place. Themes, plugins, desktop, and one CLI. Live in ~60s.
keywords:
  [
    reactpress,
    self-hosted publishing,
    react cms,
    wordpress alternative,
    headless cms,
    themes,
    plugins,
    next.js,
    react,
    nestjs,
    self-hosted,
  ]
---

## Core idea

**Write with Focus. Publish with Joy.**

**ReactPress** is a **self-hosted publishing platform** to write, manage, and publish — all in one place. The core product is ReactPress CMS; one global CLI ships the API, Web Admin, swappable Next.js themes, plugins, and an Electron desktop client.

## Learning path (0 → 100)

Choose a starting point by role. Every doc includes a summary and next-step links.

| Stage            | Who you are                         | Start here                                                                                                                                                                                                  |
| ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0→1**          | First time hearing about ReactPress | [What is ReactPress?](./getting-started/what-is-reactpress.md) · [Next.js blog in 60s](./getting-started/build-nextjs-blog-in-60-seconds.md) · [vs WordPress](./getting-started/reactpress-vs-wordpress.md) |
| **1→10**         | Site owner / blogger                | [User guide](./user-guide/admin-overview.md) → [SEO settings](./user-guide/site-settings-seo.md)                                                                                                            |
| **10→50**        | Frontend developer                  | [Theme development](./developer-guide/theme-development.md) → [Headless API](./developer-guide/headless-api.md)                                                                                             |
| **50→100**       | Full-stack / contributor            | [Monorepo development](./developer-guide/local-development.md) → [Plugin development](./developer-guide/plugin-development.md)                                                                              |
| **Go live**      | Operations                          | [Production deployment](./tutorial-basics/deploy-your-site.md) → [Docker](./tutorial-extras/docker-deployment.md)                                                                                           |
| **Troubleshoot** | Hit a problem                       | [FAQ](./reference/faq.md) → [Troubleshooting](./reference/troubleshooting.md)                                                                                                                               |

## Features

- ✍️ **Writing & content** — Create, organize, and publish from a focused editor
- 🎨 **Themes** — Customize the look and feel. [Starter](https://github.com/reactpressjs/reactpress-theme-starter) · [Guide](./developer-guide/theme-development.md)
- 🧩 **Plugins** — Extend ReactPress with hooks. [Guide](./developer-guide/plugin-development.md)
- 🖥️ **Desktop app** — The same experience on the desktop. [Guide](./tutorial-extras/desktop-client.md)
- 📱 **Multi-device** — Works on desktop, tablet, and mobile browsers

**ReactPress 5.0** (codename **Intelligent**) adds **AI Assist** on top of 4.0: Skills write drafts, and a person approves them in Review Inbox. See [ReactPress 5.0 Intelligent](./tutorial-extras/reactpress-5-0.md).

## Quick start

Requires **Node.js 20+**.

```bash
npm install -g @reactpressjs/reactpress
mkdir my-site && cd my-site
reactpress init
```

| Service         | URL                          |
| --------------- | ---------------------------- |
| Website         | http://localhost:3001        |
| Admin Dashboard | http://localhost:3001/admin/ |

Default credentials: `admin` / `admin` — **change the password before going public**.

Run `reactpress doctor` to diagnose issues. Stop services with `reactpress stop`.

:::info 5.0 note
`init` **auto-starts** API, Admin, and theme, and activates **AI Assist**. No need to run `reactpress dev` (removed from the global CLI).
:::

### Deploy to Vercel

Based on the [Theme Starter](https://github.com/reactpressjs/reactpress-theme-starter):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Freactpressjs%2Freactpress-theme-starter)

Theme demo: [reactpress-theme-starter.vercel.app](https://reactpress-theme-starter.vercel.app)

## Live demos

[ReactPress Demo](https://blog.gaoredu.com/) · [Official theme demo](https://reactpress-theme-starter.vercel.app)

## Comparison

| Feature           | ReactPress                              | WordPress             | VuePress              |
| ----------------- | --------------------------------------- | --------------------- | --------------------- |
| **Stack**         | React + Next.js + SQLite/MySQL + NestJS | PHP + MySQL           | Vue.js                |
| **Type**          | Self-hosted publishing platform / CMS   | Open-source CMS       | Static site generator |
| **Separation**    | Front-end & back-end separated          | Traditional monolith  | Supported             |
| **SEO**           | Excellent (SSR)                         | Good                  | Excellent (static)    |
| **Extensibility** | Themes + plugin hooks + Headless API    | Huge plugin ecosystem | Themes & plugins      |
| **Best for**      | React teams, bloggers, self-hosters     | Non-technical editors | Documentation authors |

Full comparison: [ReactPress vs WordPress](./getting-started/reactpress-vs-wordpress.md).

## Packages & docs

| Resource                                                                           | Description                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Site reactpress.cc](https://www.reactpress.cc/)                                   | Official website                                 |
| [Source repo](https://github.com/reactpressjs/reactpress)                          | Official repository (reactpressjs)               |
| [npm](https://www.npmjs.com/~reactpressjs)                                         | Official npm account                             |
| [@reactpressjs/reactpress](https://www.npmjs.com/package/@reactpressjs/reactpress) | 5.0 main package (CLI + API + plugins + desktop) |
| [Desktop client](./tutorial-extras/desktop-client.md)                              | Install, local / remote modes                    |
| [ReactPress 5.0](./tutorial-extras/reactpress-5-0.md)                              | Current release: AI Assist and Review Inbox      |
| [Migrate 4.x → 5.0](./tutorial-extras/migration-4-to-5.md)                         | Upgrade guide                                    |
| [@reactpressjs/reactpress-toolkit](./tutorial-extras/toolkit-package.md)           | TypeScript API SDK (Headless)                    |

## Community

1. Run `reactpress doctor` and `reactpress logs` first
2. [GitHub Issues](https://github.com/reactpressjs/reactpress/issues)
3. [GitHub Discussions](https://github.com/reactpressjs/reactpress/discussions)
4. [Contributing guide](https://github.com/reactpressjs/reactpress/blob/master/CONTRIBUTING.md)

Email: admin@gaoredu.com

## FAQ

<details>
<summary><strong>What is ReactPress?</strong></summary>

A self-hosted publishing platform to write, manage, and publish in one place. One CLI ships CMS API, Web Admin, Next.js themes, plugins, and a desktop client.

</details>

<details>
<summary><strong>Is ReactPress free?</strong></summary>

Yes — MIT open source. Install with `npm i -g @reactpressjs/reactpress`.

</details>

<details>
<summary><strong>ReactPress vs WordPress?</strong></summary>

See [ReactPress vs WordPress (2026)](./getting-started/reactpress-vs-wordpress.md). Short version: WordPress wins on plugin ecosystem and non-technical editors; ReactPress fits React/Next.js stacks, SSR SEO, and Headless workflows.

</details>

<details>
<summary><strong>Can I migrate from WordPress?</strong></summary>

Content can move via export scripts or the Headless API; themes need to be rebuilt in Next.js. See [FAQ](./reference/faq.md) and [Headless API](./developer-guide/headless-api.md).

</details>

More: [Full FAQ](./reference/faq.md) · [About](/about) · [Contact](/contact)
