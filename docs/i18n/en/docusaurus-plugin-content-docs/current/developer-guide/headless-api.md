---
sidebar_position: 3
title: Headless API Guide
description: ReactPress Headless REST API — Swagger docs, API Key auth, article list curl examples, and Toolkit TypeScript SDK.
keywords: [reactpress, headless, api, rest, swagger, api key, toolkit]
---

# Headless API Guide

ReactPress ships a **Headless REST API** by default. Any frontend (Next.js, Remix, mobile) can read and write content over HTTP.

## Explore the API

After local startup, open Swagger UI:

```
http://localhost:3002/api
```

Production: `https://your-api-domain.com/api`

## Authentication

### Session / JWT (Admin same-origin)

Admin SPA uses Bearer Token after login — for in-browser requests.

### API Key (recommended for Headless / agents)

1. Create a `read,write` key:

```bash
reactpress content key --create --save
# or: Admin JWT → POST /api/api-key  body: { "name": "agent", "scopes": "read,write" }
```

2. Send header:

```bash
curl -H "X-API-Key: YOUR_KEY" \
  "http://localhost:3002/api/article/headless/list?status=publish&page=1&pageSize=10"
```

- `read`: `GET /api/article/headless/list`
- `write` (or `*`): create/update/delete articles, tags, categories, and upload media

:::warning
Write-scoped API Keys grant admin write access. Never commit them to public repos. Use HTTPS in production and rotate regularly.
:::

### Agent Skill

External agents (Cursor and compatible tools) can install a portable skill for install → draft → publish:

```bash
npx skills add reactpressjs/reactpress --skill blog-ai -a cursor -y
```

See [`skills/blog-ai/SKILL.md`](https://github.com/reactpressjs/reactpress/blob/master/skills/blog-ai/SKILL.md) in the repository.

## Common endpoints

| Method | Path                         | Description                                        |
| ------ | ---------------------------- | -------------------------------------------------- |
| GET    | `/api/health`                | Health check                                       |
| GET    | `/api/article/headless/list` | Paginated published posts (API Key `read`)         |
| GET    | `/api/article/:id`           | Single post                                        |
| GET    | `/api/page/list`             | Page list                                          |
| GET    | `/api/category`              | Categories                                         |
| GET    | `/api/tag`                   | Tags                                               |
| GET    | `/api/comment/list`          | Comments                                           |
| GET    | `/api/setting/public`        | Public site settings                               |
| POST   | `/api/article`               | Create post (JWT admin or API Key `write`)         |
| PATCH  | `/api/article/:id`           | Update/publish post (JWT admin or API Key `write`) |
| POST   | `/api/file/upload`           | Upload media (JWT admin or API Key `write`)        |

Exact paths and parameters are defined in Swagger.

## curl examples

### Health check

```bash
curl http://localhost:3002/api/health
```

### Article list

```bash
curl -G "http://localhost:3002/api/article/headless/list" \
  -H "X-API-Key: YOUR_KEY" \
  --data-urlencode "status=publish" \
  --data-urlencode "page=1" \
  --data-urlencode "pageSize=10"
```

## Toolkit SDK (TypeScript)

Recommended typed client for Node / React:

```bash
npm install @reactpressjs/reactpress-toolkit
```

```typescript
import { api } from '@reactpressjs/reactpress-toolkit';

const articles = await api.article.findAll({
  status: 'publish',
  page: 1,
  pageSize: 10,
});
```

See [Toolkit guide](../tutorial-extras/toolkit-package.md).

## Webhook (outbound)

Server sends HTTP POST to configured URLs on content changes, e.g. `article.published`. Complements Plugin Hooks (inbound, can mutate data).

Configure: Admin → **Settings → Webhook**

## Custom frontend path

1. Fork [reactpress-theme-starter](https://github.com/reactpressjs/reactpress-theme-starter)
2. Point API via env: `NEXT_PUBLIC_API_URL`
3. Deploy to Vercel / self-hosted Node
4. Content stays on ReactPress API; frontend deploys independently

## CORS

Remote Admin / desktop client / third-party frontends need allowed Origins. Configure CORS whitelist on Server or Nginx in production.

## Related docs

- [Architecture overview](./architecture-overview.md)
- [Theme development](./theme-development.md)
- [Production deployment](../tutorial-basics/deploy-your-site.md)
