<p align="center">
  <a href="https://www.reactpress.cc/">
    <img src="./public/brand/logo.png" alt="ReactPress" width="280" />
  </a>
</p>

<h3 align="center">Write with Focus. Publish with Joy.</h3>

<p align="center">
  Publishing should not cost more than writing.<br />
  Open-source, self-hosted publishing — one command, full stack.
</p>

<p align="center">
  <a href="https://github.com/reactpressjs/reactpress/stargazers"><img src="https://img.shields.io/github/stars/reactpressjs/reactpress?style=flat-square&logo=github" alt="Stars" /></a>
  <a href="https://www.npmjs.com/package/reactpressjs"><img src="https://img.shields.io/npm/v/reactpressjs?style=flat-square&logo=npm&label=npm" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/reactpressjs"><img src="https://img.shields.io/npm/dm/reactpressjs?style=flat-square&label=downloads" alt="downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/reactpressjs/reactpress?style=flat-square" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="https://reactpress.cc/">Docs</a> ·
  <a href="https://demo.reactpress.cc/">Demo</a> ·
  <a href="https://demo.reactpress.cc/">Next.js Theme</a> ·
  <a href="https://wordpress.org/themes/reactpress-blog/">WordPress Theme</a> ·
  <a href="https://github.com/reactpressjs/reactpress">GitHub</a> ·
  <a href="./README-zh_CN.md">简体中文</a>
</p>

https://github.com/user-attachments/assets/bf1ceee9-690c-4db7-af82-fc1ff01770d4

## What is ReactPress

Publishing still costs more than writing — Docker, Nginx, DBA work, and multi-repo glue before a single paragraph ships. **ReactPress ends that publishing tax.**

One CLI starts CMS, Admin, theme, and plugins. You write and publish; infrastructure stays minimal, controllable, and self-hosted. Built for everyone who ships content — writers, builders, and teams. Local-first; Docker / MySQL when you grow, not as a gate to the first article.

|             |                                                       |
| :---------- | :---------------------------------------------------- |
| **Write**   | Built-in Admin — posts, pages, media                  |
| **Manage**  | Headless API + plugins — extend without forking       |
| **Publish** | Next.js themes on npm — swap look, keep content       |
| **AI**      | Drafts with your API key — you approve before publish |

## Why ReactPress

|             | Typical path                         | ReactPress                               |
| :---------- | :----------------------------------- | :--------------------------------------- |
| **Start**   | Assemble API + Admin + site yourself | `reactpress init` → write in ~1 minute   |
| **Stack**   | Ops-heavy before first publish       | One CLI, versions aligned                |
| **Theme**   | Locked to the platform runtime       | Normal Next.js apps on npm               |
| **Control** | Hosted black box or opaque AI        | Self-hosted data; AI assists, you decide |

## Quick Start

Requires Node.js 20+.

```bash
npm install -g reactpressjs
mkdir my-site && cd my-site
reactpress init
```

| Surface | URL                          |
| :------ | :--------------------------- |
| Site    | http://localhost:3001        |
| Admin   | http://localhost:3001/admin/ |
| API     | http://127.0.0.1:3002/api    |

Default login: `admin` / `admin` — change before production. Stuck? `reactpress doctor`.

```bash
npx skills add reactpressjs/reactpress --skill blog-ai   # optional Agent workflow
```

<p>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Freactpressjs%2Freactpress-theme-starter">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
</p>

Theme starter · [repo](https://github.com/reactpressjs/reactpress-theme-starter) · [live](https://demo.reactpress.cc/)

## Ecosystem

|                                                                        |                                             |
| :--------------------------------------------------------------------- | :------------------------------------------ |
| [Documentation](https://reactpress.cc/)                                | Guides, API, architecture                   |
| [Themes](./themes/README.md)                                           | Build & publish Next.js themes              |
| [WordPress Theme](https://wordpress.org/themes/reactpress-blog/)       | Official block theme for WordPress sites    |
| [Plugins](./plugins/README.md)                                         | Extend Admin and API                        |
| [Desktop](./desktop/README.md)                                         | Same stack as a native app                  |
| [CLI](./cli/README.md)                                                 | `reactpressjs` → `@reactpressjs/reactpress` |
| [Docker](https://reactpress.cc/docs/tutorial-extras/docker-deployment) | MySQL / production Compose                  |

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE) © reactpressjs
