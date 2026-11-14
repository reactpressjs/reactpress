<p align="center">
  <a href="https://www.reactpress.cc/">
    <img src="./public/brand/logo.png" alt="ReactPress" width="280" />
  </a>
</p>

<h3 align="center">Write with Focus. Publish with Joy.</h3>

<p align="center">
  开源自托管发布平台。CMS、管理后台、无头 API、<br />
  Next.js 主题、插件与桌面端，一条 CLI 全部装齐。
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
  <a href="https://blog.gaoredu.com/">在线演示</a> ·
  <a href="https://demo.reactpress.cc/">主题演示</a> ·
  <a href="https://github.com/reactpressjs/reactpress">GitHub</a> ·
  <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="./public/poster.png" alt="ReactPress" width="100%" />
</p>

## 核心能力

写作体验对齐 WordPress，工程体验对齐现代前端栈。本地起步无需 Docker、nginx 或独立数据库。

| 模块            | 说明                                                                                    |
| :-------------- | :-------------------------------------------------------------------------------------- |
| **CMS API**     | NestJS 无头 REST；默认 SQLite，可选 MySQL                                               |
| **管理后台**    | `/admin/` — 文章、页面、媒体、插件、主题                                                |
| **主题**        | 可 npm 安装的 Next.js 站点，换肤不动内容                                                |
| **插件**        | 扩展能力，无需 fork 核心                                                                |
| **AI Assist**   | 自带 API Key。Skill 写草稿，人工通过后发布                                              |
| **Agent Skill** | `npx skills add reactpressjs/reactpress --skill blog-ai` — 在 Cursor 中安装、写稿、发布 |
| **桌面端**      | 同一套栈，打包为原生应用                                                                |
| **CLI**         | `init` · `doctor` · `logs` · `stop`                                                     |

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

默认账号 `admin` / `admin`，上线前请修改密码。排查问题：`reactpress doctor`。

<p>
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Freactpressjs%2Freactpress-theme-starter">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
</p>

一键部署主题起步模板 · [仓库](https://github.com/reactpressjs/reactpress-theme-starter) · [预览](https://demo.reactpress.cc/)

## 生态

- [文档](https://reactpress.cc/) — 使用指南、API 与架构
- [主题开发](./themes/README.md) — 构建并发布 Next.js 主题
- [插件开发](./plugins/README.md) — 扩展后台与 API
- [桌面端](./desktop/README.md) — 打包为桌面应用
- [CLI](./cli/README.md) — `reactpressjs` → `@reactpressjs/reactpress`

## 贡献

欢迎提交 Issue 与 Pull Request，详见 [贡献指南](./CONTRIBUTING.md) 与 [更新日志](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE) © reactpressjs
