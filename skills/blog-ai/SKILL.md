---
name: blog-ai
description: >-
  Install ReactPress, write Markdown posts with SEO frontmatter, and publish via
  `reactpress content` / Headless API. Use when the user wants a ReactPress blog
  site, article draft, rewrite, SEO, tags, media upload, or publish from an agent.
---

# Blog AI (ReactPress)

Help authors **install ReactPress**, produce Markdown posts, and run the content
lifecycle (draft → publish) through the CLI / Headless API. Prefer the CLI over
pasting into Admin.

## End-to-end chain

```bash
# 1) Install this skill (Cursor / compatible agents)
npx skills add reactpressjs/reactpressjs --skill blog-ai -a cursor -y

# 2) Install CLI + bootstrap a site
npm install -g reactpressjs
mkdir my-site && cd my-site
reactpress init
# Site http://localhost:3001 · Admin /admin/ · API http://127.0.0.1:3002/api
# Default login: admin / admin

# 3) Mint a write-scoped API key (saves REACTPRESS_API_KEY to .env)
reactpress content key --create --save

# 4) Write Markdown, create draft, publish when asked
reactpress content article create --file ./tmp/post.md
reactpress content article publish --id <id>
# or: reactpress content article create --file ./tmp/post.md --publish
```

Environment overrides: `REACTPRESS_API_URL`, `REACTPRESS_API_KEY`,
`REACTPRESS_ADMIN_USER`, `REACTPRESS_ADMIN_PASSWORD`.

## Article fields

| Field            | Role                                              |
| ---------------- | ------------------------------------------------- |
| `title`          | Clear H1-level title                              |
| `content`        | Markdown body (source of truth)                   |
| `summary`        | ~120–160 chars, plain text, no Markdown           |
| `slug`           | URL alias: lowercase, hyphenated, ASCII preferred |
| `seoKeywords`    | Comma-separated keywords                          |
| `seoDescription` | ~150–160 chars meta description                   |
| `tags`           | Short topic labels (CLI creates missing tags)     |
| `category`       | One category label (CLI creates if missing)       |

Default deliverable:

```markdown
---
title: …
slug: …
summary: …
seoKeywords: …
seoDescription: …
tags: [a, b]
category: …
---

# Title matching frontmatter

Body in Markdown…
```

## Writing rules

- Prefer concrete titles over vague ones.
- Body: short paragraphs, scannable `##` / `###`, fenced code with language tags.
- Match the user’s language unless they ask otherwise.
- Do not invent publish dates, view counts, or live URLs.
- **Publish only when the user explicitly asks** to publish.

## Agent actions

| Ask                    | Action                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| Install / bootstrap    | Run `reactpress init` (or guide install) then `content key --create --save` |
| Generate               | Write full Markdown + meta; save under e.g. `tmp/post.md`                   |
| Rewrite / polish / SEO | Edit the Markdown file in place                                             |
| Tags / category        | Suggest 3–8 tags and one category                                           |
| Draft                  | `reactpress content article create --file …`                                |
| Publish                | `reactpress content article publish --id …` or `--publish`                  |
| Media                  | `reactpress content media --upload --file ./cover.png`                      |
| llms.txt               | Draft a site `llms.txt` outline (file only)                                 |

## Auth notes

- Write routes accept **admin JWT** or **API Key** with `write` (or `*`) scope via `X-API-Key`.
- `reactpress content key --create` logs in as admin, creates `read,write`, optionally saves to `.env`.
- Curl equivalent:

```bash
curl -X POST "$REACTPRESS_API_URL/article" \
  -H "X-API-Key: $REACTPRESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"…","content":"# …","status":"draft","summary":"…","slug":"…"}'

curl -X PATCH "$REACTPRESS_API_URL/article/<id>" \
  -H "X-API-Key: $REACTPRESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"publish"}'
```

In-product **AI Assist** (Admin) stays draft + human Pending review — do not change that gate from this skill.

## llms.txt outline

```text
# {Site name}
> {One-line site summary}

## Docs
- {Home or docs URL}: {short note}

## Blog
- {Article URL or path}: {title} — {one-line summary}
```

List only posts/paths the user provides or that exist. Do not invent URLs.
