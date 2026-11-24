<p align="center">
  <a href="https://www.reactpress.cc/">
    <img src="./public/brand/logo.png" alt="ReactPress" width="280" />
  </a>
</p>

<h3 align="center">Write with Focus. Publish with Joy.</h3>

<p align="center">
  发布不该比写作更贵。<br />
  开源、可自托管的发布栈 — 一条命令，完整产品。
</p>

<p align="center">
  <a href="https://github.com/reactpressjs/reactpress/stargazers"><img src="https://img.shields.io/github/stars/reactpressjs/reactpress?style=flat-square&logo=github" alt="Stars" /></a>
  <a href="https://www.npmjs.com/package/reactpressjs"><img src="https://img.shields.io/npm/v/reactpressjs?style=flat-square&logo=npm&label=npm" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/reactpressjs"><img src="https://img.shields.io/npm/dm/reactpressjs?style=flat-square&label=downloads" alt="downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/reactpressjs/reactpress?style=flat-square" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="https://reactpress.cc/">文档</a> ·
  <a href="https://demo.reactpress.cc/">在线演示</a> ·
  <a href="https://demo.reactpress.cc/">Next.js 主题</a> ·
  <a href="https://wordpress.org/themes/reactpress-blog/">WordPress 主题</a> ·
  <a href="https://github.com/reactpressjs/reactpress">GitHub</a> ·
  <a href="./README.md">English</a>
</p>

https://github.com/user-attachments/assets/bf1ceee9-690c-4db7-af82-fc1ff01770d4

## 产品是什么

发布仍然比写作更贵 — Docker、Nginx、数据库运维、多仓库胶水，第一段字还没发出去。**ReactPress 拿掉这份「发布税」。**

一条 CLI 拉起 CMS、管理后台、主题与插件。你专注写与发；基建保持极简、可控、可自托管。面向每一个要发出内容的人 — 写作者、开发者与团队。本地优先；Docker / MySQL 按需启用，不是发出第一篇文章的门槛。

|        |                                        |
| :----- | :------------------------------------- |
| **写** | 内置后台 — 文章、页面、媒体            |
| **管** | 无头 API + 插件 — 扩展无需 fork        |
| **发** | npm 上的 Next.js 主题 — 换肤，内容不动 |
| **AI** | 自备 Key 写草稿 — 人审核后再发布       |

## 为什么是 ReactPress

|          | 常见路径                 | ReactPress                        |
| :------- | :----------------------- | :-------------------------------- |
| **起步** | 自己拼 API + 后台 + 站点 | `reactpress init` → 约 1 分钟可写 |
| **栈**   | 发稿前先扛一堆运维       | 一条 CLI，版本对齐                |
| **主题** | 绑死在平台运行时         | 普通 Next.js，走 npm              |
| **掌控** | 托管黑盒或 AI 黑盒       | 数据自托管；AI 辅助，你拍板       |

## 快速开始

需要 Node.js 20+。

```bash
npm install -g reactpressjs
mkdir my-site && cd my-site
reactpress init
```

| 入口     | 地址                         |
| :------- | :--------------------------- |
| 网站     | http://localhost:3001        |
| 管理后台 | http://localhost:3001/admin/ |
| API      | http://127.0.0.1:3002/api    |

默认账号 `admin` / `admin`，上线前请修改。排查：`reactpress doctor`。

```bash
npx skills add reactpressjs/reactpress --skill blog-ai   # 可选 Agent 工作流
```

<p>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Freactpressjs%2Freactpress-theme-starter">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
</p>

主题起步模板 · [仓库](https://github.com/reactpressjs/reactpress-theme-starter) · [预览](https://demo.reactpress.cc/)

## 生态

|                                                                        |                                             |
| :--------------------------------------------------------------------- | :------------------------------------------ |
| [文档](https://reactpress.cc/)                                         | 指南、API、架构                             |
| [主题开发](./themes/README.md)                                         | 构建并发布 Next.js 主题                     |
| [WordPress 主题](https://wordpress.org/themes/reactpress-blog/)        | 官方 WordPress 区块主题                     |
| [插件开发](./plugins/README.md)                                        | 扩展后台与 API                              |
| [桌面端](./desktop/README.md)                                          | 同一套栈的原生应用                          |
| [CLI](./cli/README.md)                                                 | `reactpressjs` → `@reactpressjs/reactpress` |
| [Docker](https://reactpress.cc/docs/tutorial-extras/docker-deployment) | MySQL / 生产 Compose                        |

## 贡献

欢迎 Issue 与 PR。详见 [贡献指南](./CONTRIBUTING.md) 与 [更新日志](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE) © reactpressjs
