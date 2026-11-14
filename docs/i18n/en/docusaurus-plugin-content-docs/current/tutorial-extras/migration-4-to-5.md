---
sidebar_position: 2
title: Migrate from 4.x to 5.0
description: ReactPress 4.x to 5.0 migration — AI Assist is additive. No directory changes. New installs enable the plugin automatically.
keywords: [reactpress, migration, 4.x, 5.0, ai assist]
---

# Migrate from 4.x to 5.0

ReactPress **5.0 Intelligent** adds AI Assist on top of 4.0. Content, themes, and other plugins stay in place.

Overview: [ReactPress 5.0 Intelligent](./reactpress-5-0.md).

## Who needs to do something

| Situation                                  | Action                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| New `reactpress init`                      | AI Assist is installed and activated. Paste an API Key.                |
| Existing 4.x site that already has plugins | Admin → Plugins → install and activate **AI Assist**, then paste a key |
| Headless / theme author                    | No breaking change. AI routes are admin-only                           |

## Upgrade

The global CLI package is **`@reactpressjs/reactpress`**. If an older-scoped global install remains, uninstall it first:

```bash
npm uninstall -g reactpress 2>/dev/null || true
npm i -g reactpressjs
cd your-site
reactpress doctor
```

Monorepo:

```bash
git pull
pnpm install
pnpm run build:plugins
pnpm dev
```

## What changed

- Package version **5.0.0** for the CLI, server, Admin, toolkit, and desktop app
- Plugin `ai-assist` and `/api/ai/*` (JWT admin)
- Review Inbox can publish immediately or set `scheduledPublishAt`
- API keys are encrypted in plugin settings. A key saved in plaintext by an older build is encrypted the next time you save settings

## What did not change

- SQLite by default, MySQL optional
- Theme `theme.json` and the plugin hook model
- Skills never set `status=publish` by themselves
