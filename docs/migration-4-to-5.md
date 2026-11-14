# Migrate from 4.x to 5.0

Site copies: [English](./i18n/en/docusaurus-plugin-content-docs/current/tutorial-extras/migration-4-to-5.md) · [中文](./tutorial/tutorial-extras/migration-4-to-5.md) · [5.0 overview](./i18n/en/docusaurus-plugin-content-docs/current/tutorial-extras/reactpress-5-0.md)

ReactPress **5.0 Intelligent** adds the `ai-assist` plugin on top of 4.0. Themes, content, and other plugins stay put.

## Upgrade

The global CLI package is **`@reactpressjs/reactpress`**. If an older-scoped global install remains, uninstall it first, then:

```bash
npm i -g @reactpressjs/reactpress
cd your-site
reactpress doctor
```

New `reactpress init` installs and activates **AI Assist**. An existing site that already has plugins must activate **AI Assist** once in Admin → Plugins, then paste an OpenAI-compatible API Key.

Skills write drafts only. Review Inbox → Approve publishes immediately or schedules `scheduledPublishAt`. The API Key is encrypted at rest.
