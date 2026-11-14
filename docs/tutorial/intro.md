---
sidebar_position: 1
id: intro
title: 介绍
description: >-
  ReactPress 官方文档 — 可自托管的发布平台，写作、管理、发布一站式完成。
  主题、插件、桌面端与一条 CLI，约 60 秒上线。
keywords:
  [
    reactpress,
    自托管发布平台,
    react cms,
    wordpress 替代,
    headless cms,
    主题,
    插件,
    next.js,
    react,
    nestjs,
    自托管,
    官方文档,
  ]
---

## 核心理念

**Write with Focus. Publish with Joy.**

**ReactPress** 是一个**可自托管的发布平台**：写作、管理、发布，一站式完成。核心是 ReactPress CMS；一条全局 CLI 即可运行 API、Web 管理后台、可替换的 Next.js 主题、插件扩展与 Electron 桌面客户端。

## 学习路径（0 → 100）

按角色选择起点，每篇文档均含摘要与下一步链接。

| 阶段       | 你是谁                | 从这里开始                                                                                                                                                                                                   |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0→1**    | 第一次听说 ReactPress | [ReactPress 是什么？](./getting-started/what-is-reactpress.md) · [60 秒 Next.js 博客](./getting-started/build-nextjs-blog-in-60-seconds.md) · [对比 WordPress](./getting-started/reactpress-vs-wordpress.md) |
| **1→10**   | 站长 / 博主           | [使用指南](./user-guide/admin-overview.md) → [SEO 设置](./user-guide/site-settings-seo.md)                                                                                                                   |
| **10→50**  | 前端开发者            | [主题开发](./developer-guide/theme-development.md) → [Headless API](./developer-guide/headless-api.md)                                                                                                       |
| **50→100** | 全栈 / 贡献者         | [Monorepo 开发](./developer-guide/local-development.md) → [插件开发](./developer-guide/plugin-development.md)                                                                                                |
| **上线**   | 运维                  | [生产部署](./tutorial-basics/deploy-your-site.md) → [Docker](./tutorial-extras/docker-deployment.md)                                                                                                         |
| **排错**   | 遇到问题              | [FAQ](./reference/faq.md) → [故障排查](./reference/troubleshooting.md)                                                                                                                                       |

## 功能特性

- ✍️ **写作与内容管理** — 在专注的编辑器中创建、整理并发布内容
- 🎨 **主题** — 自定义网站外观。[起步模板](https://github.com/reactpressjs/reactpress-theme-starter) · [主题指南](./developer-guide/theme-development.md)
- 🧩 **插件** — 通过 Hook 扩展 ReactPress。[插件指南](./developer-guide/plugin-development.md)
- 🖥️ **桌面应用** — 在桌面端获得同样的使用体验。[桌面端指南](./tutorial-extras/desktop-client.md)
- 📱 **多端访问** — 支持桌面、平板与移动端浏览器

**ReactPress 5.0**（代号 **Intelligent**）在 4.0 之上加入 **AI Assist**：Skill 写草稿，人在审核收件箱通过后才发布。详见 [ReactPress 5.0 智能版](./tutorial-extras/reactpress-5-0.md)。

## 快速开始

需要 **Node.js 20+**。

```bash
npm install -g reactpressjs
mkdir my-site && cd my-site
reactpress init
```

初始化完成后访问：

| 服务     | 地址                         |
| -------- | ---------------------------- |
| 网站     | http://localhost:3001        |
| 管理后台 | http://localhost:3001/admin/ |

默认账号：`admin` / `admin` —— **对外发布前请务必修改默认密码**。

运行 `reactpress doctor` 可进行问题诊断。停止服务用 `reactpress stop`。

:::info 5.0 说明
`init` 会**自动启动** API、Admin 与主题，并启用 **AI Assist**。无需再执行 `reactpress dev`（该命令在全局 CLI 中已移除）。
:::

### 部署到 Vercel

基于 [主题起步模板](https://github.com/reactpressjs/reactpress-theme-starter)：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Freactpressjs%2Freactpress-theme-starter)

主题演示：[reactpress-theme-starter.vercel.app](https://reactpress-theme-starter.vercel.app)

## 在线示例

[ReactPress Demo](https://blog.gaoredu.com/) · [官方主题演示](https://reactpress-theme-starter.vercel.app)

## 框架对比

| 项目           | ReactPress                              | WordPress            | VuePress       |
| -------------- | --------------------------------------- | -------------------- | -------------- |
| **技术栈**     | React + Next.js + SQLite/MySQL + NestJS | PHP + MySQL          | Vue.js         |
| **类型**       | 自托管发布平台 / CMS                    | 开源发布平台 / CMS   | 静态站点生成器 |
| **前后端分离** | 支持                                    | 传统一体化           | 支持           |
| **SEO**        | 出色（SSR）                             | 良好                 | 优秀（静态）   |
| **扩展性**     | 主题 + 插件 Hook + Headless API         | 插件生态庞大         | 主题与插件     |
| **适合谁**     | React 团队、博主、自托管用户            | 非技术编辑、传统站点 | 文档作者       |

完整对比见 [ReactPress vs WordPress](./getting-started/reactpress-vs-wordpress.md)。

## 包与文档

| 资源                                                                               | 说明                                |
| ---------------------------------------------------------------------------------- | ----------------------------------- |
| [官网 reactpress.cc](https://www.reactpress.cc/)                                   | 官方唯一站点                        |
| [源码仓库](https://github.com/reactpressjs/reactpressjs)                           | 官方唯一仓库（reactpressjs）        |
| [npm](https://www.npmjs.com/~reactpressjs)                                         | 官方 npm 账号                       |
| [@reactpressjs/reactpress](https://www.npmjs.com/package/@reactpressjs/reactpress) | 5.0 主包（CLI + API + 插件 + 桌面） |
| [桌面客户端](./tutorial-extras/desktop-client.md)                                  | 下载安装、本地 / 远程模式           |
| [ReactPress 5.0](./tutorial-extras/reactpress-5-0.md)                              | 当前版本：AI Assist 与审核收件箱    |
| [4.x → 5.0 迁移](./tutorial-extras/migration-4-to-5.md)                            | 升级指南                            |
| [@reactpressjs/reactpress-toolkit](./tutorial-extras/toolkit-package.md)           | TypeScript API SDK（Headless）      |

## 社区互助

1. 先运行 `reactpress doctor` 与 `reactpress logs`
2. [GitHub Issues](https://github.com/reactpressjs/reactpressjs/issues)
3. [GitHub Discussions](https://github.com/reactpressjs/reactpressjs/discussions)
4. [贡献指南](https://github.com/reactpressjs/reactpressjs/blob/master/CONTRIBUTING.md)

Email: admin@gaoredu.com

## 常见问题 FAQ

<details>
<summary><strong>ReactPress 是什么？</strong></summary>

可自托管的发布平台 — 写作、管理、发布一站式完成。一条 CLI 包含 CMS API、Web Admin、Next.js 主题、插件与桌面客户端。

</details>

<details>
<summary><strong>ReactPress 免费吗？</strong></summary>

是，MIT 开源。安装：`npm i -g reactpressjs`。

</details>

<details>
<summary><strong>ReactPress 和 WordPress 怎么选？</strong></summary>

详见 [ReactPress vs WordPress (2026)](./getting-started/reactpress-vs-wordpress.md)。简要：WordPress 插件生态与非技术编辑者更强；ReactPress 在 React/Next.js 技术栈、SSR SEO 与 Headless 架构上更对口。

</details>

<details>
<summary><strong>能从 WordPress 迁移吗？</strong></summary>

内容可通过导出脚本或 Headless API 对接迁移；主题需在 Next.js 中重建。见 [FAQ](./reference/faq.md) 与 [Headless API](./developer-guide/headless-api.md)。

</details>

更多问题：[完整 FAQ](./reference/faq.md) · [关于我们](/zh/about) · [联系我们](/zh/contact)
