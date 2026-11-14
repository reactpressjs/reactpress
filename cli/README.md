# @reactpressjs/reactpress

> **Write with Focus. Publish with Joy.**
>
> CMS, Admin, Headless API, Next.js themes, plugins & desktop in one CLI.

[![npm latest](https://img.shields.io/npm/v/@reactpressjs/reactpress.svg?label=latest)](https://www.npmjs.com/package/@reactpressjs/reactpress)
[![npm beta](https://img.shields.io/npm/v/@reactpressjs/reactpress/beta.svg?label=beta)](https://www.npmjs.com/package/@reactpressjs/reactpress/v/beta)
[![npm downloads](https://img.shields.io/npm/dm/@reactpressjs/reactpress.svg)](https://www.npmjs.com/package/@reactpressjs/reactpress)
[![License: MIT](https://img.shields.io/npm/l/@reactpressjs/reactpress.svg)](https://github.com/reactpressjs/reactpress/blob/master/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

The official **ReactPress CLI** — install a complete, self-hosted publishing stack in ~60 seconds. CMS API, Web Admin, and Next.js theme support ship together. No Docker, nginx, or external database required for local development.

| Layer       | What you get                                                                             |
| :---------- | :--------------------------------------------------------------------------------------- |
| **CMS API** | Headless NestJS REST — SQLite by default, MySQL optional                                 |
| **Admin**   | Writing console at `/admin/` — posts, pages, media, plugins, themes                      |
| **Themes**  | npm-installable Next.js frontends — swap without touching content                        |
| **CLI**     | `init`, `doctor`, `logs`, `stop`, `content` — operate, diagnose, and publish from agents |

Built for frontend teams who want WordPress-grade editing without wiring five repos together.

[Documentation](https://reactpress.cc/) · [Live demo](https://blog.gaoredu.com) · [Theme demo](https://reactpress-theme-starter.vercel.app) · [GitHub](https://github.com/reactpressjs/reactpress) · [Chinese overview](../README-zh_CN.md)

## Install

```bash
# Stable 4.x (npm @latest)
npm install -g @reactpressjs/reactpress

# Prerelease channel
# npm install -g @reactpressjs/reactpress@beta
```

Requires Node.js 20+. On first install, `postinstall` downloads bundled server runtime dependencies (~1–2 minutes).

## Quick start

```bash
mkdir my-site && cd my-site
reactpress init
```

| Surface         | URL                                              |
| :-------------- | :----------------------------------------------- |
| **Public site** | http://localhost:3001                            |
| **Admin**       | http://localhost:3001/admin/ (`admin` / `admin`) |
| **API**         | http://127.0.0.1:3002/api                        |

Run `reactpress doctor` if something does not start correctly.

## Agent / Headless content

Install the portable Cursor skill, then bootstrap and publish without opening Admin:

```bash
npx skills add reactpressjs/reactpress --skill blog-ai -a cursor -y

npm install -g @reactpressjs/reactpress
mkdir my-site && cd my-site
reactpress init
reactpress content key --create --save
reactpress content article create --file ./tmp/post.md
reactpress content article publish --id <id>
```

Write-scoped API keys authenticate with `X-API-Key`. See [skills/blog-ai](../skills/blog-ai/SKILL.md).

## Commands

| Command                   | Description                                     |
| :------------------------ | :---------------------------------------------- |
| `reactpress init [dir]`   | Initialize a new publishing site                |
| `reactpress doctor [dir]` | Diagnose Node.js, ports, database, and services |
| `reactpress logs [dir]`   | Tail API logs (error / request / response)      |
| `reactpress stop [dir]`   | Stop API and site services                      |
| `reactpress content …`    | API keys, Markdown articles, media upload       |

## Requirements

- Node.js 20+
- macOS / Linux / Windows
- Embedded SQLite + bundled API (no Docker or MySQL for local dev)

## Ecosystem

| Package                                           | Role                                                  |
| :------------------------------------------------ | :---------------------------------------------------- |
| [`@reactpressjs/reactpress-toolkit`](../toolkit/) | TypeScript SDK — API clients, theme SSR, plugin hooks |
| [`@reactpressjs/reactpress-web`](../web/)         | Admin SPA — static assets and Node mount helpers      |
| [`@reactpressjs/reactpress-server`](../server/)   | Standalone API (deprecated — use CLI bundled API)     |

## License

MIT © [reactpressjs](https://github.com/reactpressjs)

<p align="center"><sub>Part of <a href="https://github.com/reactpressjs/reactpress">ReactPress</a> — Write with Focus. Publish with Joy.</sub></p>
