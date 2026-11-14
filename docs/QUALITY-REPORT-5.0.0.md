# ReactPress 5.0.0 Quality Report

**Date:** 2026-11-14 (revalidated after `@reactpressjs` scope rename)  
**Branch / target:** `feat/v5` (version 5.0.0)  
**Verdict:** **Ready to release** for CI gates and core runtime, with noted follow-ups

---

## 1. Executive summary

Release blockers for API / Admin production build remain fixed. npm package scope is unified to **`@reactpressjs/*`**. Automated gates that matter for CI and local release packaging pass on current HEAD.

| Gate                                 | Result                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| Production build (`pnpm run build`)  | Pass — `dist/reactpress-release-5.0.0-*.tar.gz` (~128 MB) |
| Artifact verify                      | Pass (active theme: `reactpress-theme-starter`)           |
| API smoke (`/api/health`)            | Pass — `status=ok`, `database=up`                         |
| Typecheck (toolkit → web → cli)      | Pass                                                      |
| CLI unit tests                       | Pass — **136 / 136**                                      |
| Server Jest tests                    | Pass — **86 suites / 684 tests**                          |
| Web `vp check`                       | Pass — **0 errors**, 46 warnings                          |
| Docs build (`pnpm --dir docs build`) | Pass (en + zh)                                            |

---

## 2. Scope rename (5.0 packaging)

- All previous scoped package names and references → `@reactpressjs/*`
- Install command: `npm i -g @reactpressjs/reactpress`
- Theme catalog anchor: `@reactpressjs/reactpress-theme-starter@1.0.0-beta.0`
- Docs (EN/ZH): current-version claims updated to **5.0**; migration notes cover reinstall under the new scope
- Health `/api/health` version reads from `server/package.json` (no longer hardcoded `3.0.0`)

**Publish prerequisite:** create/claim the npm org **`@reactpressjs`** and publish packages under that scope (registry currently has no `@reactpressjs/reactpress` yet).

---

## 3. Remaining follow-ups (non-blocking)

1. **Admin bundle splitting** — main entry still ~5.2 MB raw (~1.5 MB gzip).
2. **Web check warnings** — 46 non-blocking (`no-base-to-string`, floating promises in mocks/node).
3. **Lighthouse SEO** — optional local audit against visitor theme.
4. **Theme npm publish** — publish `@reactpressjs/reactpress-theme-starter` so catalog installs resolve without a monorepo `file:` link.

---

## 4. Release checklist

- [x] Version aligned at **5.0.0** across core packages
- [x] npm scope **`@reactpressjs/*`** (no legacy org scope left in tracked sources)
- [x] Production artifacts build and verify
- [x] API starts and `/api/health` returns ok
- [x] CLI + server automated tests green
- [x] Typecheck green
- [x] Docs production build green
- [ ] Optional: Lighthouse SEO ≥ 90 on theme
- [ ] Optional: Admin code-split follow-up before next minor
- [ ] **npm publish** under `@reactpressjs` (org + packages)

**Ship decision:** **GO** for 5.0.0 release packaging and CI once `@reactpressjs` npm packages are published; optional SEO/bundle follow-ups in a fast-follow.
