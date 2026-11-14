<p align="center">
  <a href="https://www.reactpress.cc/">
    <img src="./public/brand/logo.png" alt="ReactPress" width="280" />
  </a>
</p>

<h3 align="center">Write with Focus. Publish with Joy.</h3>

<p align="center">
  Self-hosted publishing stack — CMS, Admin, Headless API, Next.js themes,<br />
  plugins & desktop — one CLI. No Docker required to start.
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
  <a href="https://blog.gaoredu.com/">Demo</a> ·
  <a href="https://demo.reactpress.cc/">Theme</a> ·
  <a href="https://github.com/reactpressjs/reactpress">GitHub</a> ·
  <a href="./README-zh_CN.md">简体中文</a>
</p>

<p align="center">
  <img src="./public/poster.png" alt="ReactPress" width="100%" />
</p>

## Why ReactPress

WordPress-grade editing for frontend teams — without five repos, nginx, or a DBA.

| Layer           | What you get                                                                                   |
| :-------------- | :--------------------------------------------------------------------------------------------- |
| **CMS API**     | Headless NestJS REST — SQLite by default, MySQL optional                                       |
| **Admin**       | Writing console at `/admin/` — posts, pages, media, plugins, themes                            |
| **Themes**      | npm-installable Next.js frontends — swap without touching content                              |
| **Plugins**     | Extend the platform without forking the core                                                   |
| **AI Assist**   | Bring your own API Key. Skills draft; you approve before publish                               |
| **Agent Skill** | `npx skills add reactpressjs/reactpress --skill blog-ai` — install, write, publish from Cursor |
| **Desktop**     | Same stack as a native app                                                                     |
| **CLI**         | `init` · `doctor` · `logs` · `stop` — operate from the terminal                                |

## Quick Start

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

Default login: `admin` / `admin` — change it before production.  
Stuck? Run `reactpress doctor`.

<p>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Freactpressjs%2Freactpress-theme-starter">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
</p>

Theme starter · [repo](https://github.com/reactpressjs/reactpress-theme-starter) · [live](https://demo.reactpress.cc/)

## Ecosystem

|                                         |                                             |
| :-------------------------------------- | :------------------------------------------ |
| [Documentation](https://reactpress.cc/) | Guides, API, and architecture               |
| [Themes](./themes/README.md)            | Build & publish Next.js themes              |
| [Plugins](./plugins/README.md)          | Extend Admin and the API                    |
| [Desktop](./desktop/README.md)          | Package the stack as an app                 |
| [CLI](./cli/README.md)                  | `reactpressjs` → `@reactpressjs/reactpress` |

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE) © reactpressjs
