# Repository root static assets

Marketing, demo, and brand assets for ReactPress: Write with Focus. Publish with Joy. Root [README](../README.md), [README-zh_CN](../README-zh_CN.md), and [docs site](https://reactpress.cc/).

## Brand & icons

Generate or refresh brand files from source SVGs:

```bash
pnpm export:brand
```

| Directory  | Contents                                                        |
| :--------- | :-------------------------------------------------------------- |
| `brand/`   | Logo and wordmark: `logo.svg`, `wordmark.svg`, `logo.png`, etc. |
| `favicon/` | Browser favicons: `favicon.ico`, `favicon-16/32/48.png`         |
| `icons/`   | PWA / Apple Touch: `apple-touch-icon.png`, `icon-192/512.png`   |

## Marketing & screenshots

| Path         | Contents                                                                                                                                                                    |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `poster.png` | Hero banner used by [README.md](../README.md) and [README-zh_CN](../README-zh_CN.md)                                                                                        |
| `admin/`     | Admin UI screenshots for [web/README](../web/README.md) and [docs site](https://reactpress.cc/): `post.png`, `midia.png`, `plugins.png`, `theme-custom.png`, `settings.png` |

Demo GIFs and lighthouse scores live under `docs/static/img/blog/` (docs home + blog posts), not at this root.

A copy of `admin/` is synced to `docs/static/img/admin/` for the documentation site.

Runtime apps (`web/public`, `server/public`, themes) use their own flat paths for deployment.
