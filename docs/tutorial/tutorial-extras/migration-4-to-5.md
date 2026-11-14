---
sidebar_position: 2
title: 从 4.x 迁移到 5.0
description: ReactPress 4.x 到 5.0 的迁移说明。AI Assist 是增量能力，不改目录。新安装会自动启用该插件。
keywords: [reactpress, migration, 4.x, 5.0, ai assist]
---

# 从 4.x 迁移到 5.0

ReactPress **5.0 智能版**在 4.0 之上增加 AI Assist。内容、主题和其他插件保持原位。

总览：[ReactPress 5.0 智能版](./reactpress-5-0.md)。

## 谁需要动手

| 场景                   | 动作                                               |
| ---------------------- | -------------------------------------------------- |
| 新的 `reactpress init` | AI Assist 已安装并启用。粘贴 API Key 即可          |
| 已有插件的 4.x 站点    | 后台 → 插件 → 安装并启用 **AI Assist**，再粘贴密钥 |
| Headless / 主题作者    | 无破坏性变更。AI 接口仅管理员可用                  |

## 升级

全局 CLI 包名为 **`@reactpressjs/reactpress`**。若本机仍装有旧 scope 的全局包，先卸载再安装：

```bash
npm uninstall -g reactpress 2>/dev/null || true
npm i -g reactpressjs
cd your-site
reactpress doctor
```

Monorepo：

```bash
git pull
pnpm install
pnpm run build:plugins
pnpm dev
```

## 变了什么

- CLI、server、Admin、toolkit、桌面端版本为 **5.0.0**
- 插件 `ai-assist` 与 `/api/ai/*`（管理员 JWT）
- 审核收件箱可以立即发布，或写入 `scheduledPublishAt`
- API Key 在插件配置里加密。旧版明文密钥会在下次保存设置时加密

## 没变什么

- 默认 SQLite，MySQL 可选
- 主题 `theme.json` 与插件 Hook 模型
- Skill 自己不能把文章设为 `publish`
