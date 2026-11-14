---
sidebar_position: 1
title: ReactPress 5.0 智能版
description: ReactPress 5.0 智能版 — 自带 API Key 的 AI Assist、只写草稿的 Skill，以及人工审核收件箱。当前推荐版本。
keywords: [reactpress 5.0, intelligent, ai assist, review inbox, byok]
---

# ReactPress 5.0 智能版

> **当前推荐版本。** Skill 负责写稿和整理，发布前必须由人点通过。

5.0（代号 **Intelligent**）保留 4.0 的插件、桌面端和主题，并加入官方插件 **AI Assist**。

| 部分           | 你要做的事                                                      |
| -------------- | --------------------------------------------------------------- |
| **API Key**    | 在插件设置里粘贴自己的 OpenAI 兼容密钥。ReactPress 不托管模型。 |
| **Skills**     | `write`、`organize`、`polish`、`pre-review`                     |
| **审核收件箱** | 对照提案、编辑草稿，然后立即发布或定时发布                      |
| **发布门闩**   | Skill 只能写草稿。只有通过才会发布                              |

## 快速开始

```bash
npm i -g @reactpressjs/reactpress
mkdir my-site && cd my-site
reactpress init
```

新站点会安装并启用 **AI Assist**。打开后台 → 插件 → AI Assist，粘贴 API Key，点 **测试连接**。

然后：

1. 文章 → **用 AI 创建**，或在编辑器侧栏使用补全 SEO、润色、预审。
2. **审核收件箱** → 对照 → 通过。
3. 选择 **立即发布** 或 **定时发布**。未通过之前，文章保持草稿。

密钥加密存储。只改其他设置时，Key 留空即可保留当前密钥。

## 从 4.x 升级

见 [从 4.x 迁移到 5.0](./migration-4-to-5.md)。已经在用插件的站点需要手动安装并启用 **AI Assist**。全新安装会自动完成这一步。

4.0 能力仍在：[ReactPress 4.0 扩展版](./reactpress-4-0.md)。
