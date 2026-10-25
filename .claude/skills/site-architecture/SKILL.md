---
name: site-architecture
description: How the Azat Tours codebase works and how not to break it — server-rendered pages from content/*.json, the admin bot, content migrations, UI engine contracts, regression guard, deploy via GitHub Actions. Use before editing code/data/scripts, adding fields, deploying, or when something "didn't update" or "broke" (сломалось, не обновилось, деплой, архитектура).
---

# Site architecture — change things without breaking things

Full, current map: `docs/ARCHITECTURE.md`. This skill is the short version plus the rules.

## System map
- **`server.js`** serves everything: redirects, static files (AVIF/WebP by `Accept`, `?w=` resized copies), the
  lead/chat API. Pages (`/`, `/tours/`, `/tours/<slug>/`, `/blog/…`, `*.html`, `/sitemap.xml`, `/llms.txt`) are rendered
  by **`lib/pages.js`** from `content/*.json` + `public/*.html` templates, cached in memory by file mtimes.
- **`bot.js`**: the owner's Telegram admin (grammY). Runs ONLY on the server — starting it locally with the real token
  breaks polling for the live bot. `start.js` runs site + bot in one process (pm2 `azat-tours`).
- **Two sources of truth**: code = git (push to `main` deploys); content (tours, posts, reviews, sights, site media,
  leads, chats) = the SERVER's `content/*.json`, edited live via the bot, backed up daily to the owner's Telegram.

## Data flow (the core invariant)
```
bot / migration ──▶ content/*.json ──(lib/content.js regenerate)──▶ public/*-data.js (browser scripts)
                         └────────────(lib/pages.js render)──────────▶ HTML pages
```
- **NEVER hand-edit `public/*-data.js`**; `saveTours()` etc. write the JSON and regenerate.
- **Changing existing content from code = a migration**: append `[id, steps]` to `MIGRATIONS` in `scripts/migrate.js`,
  put its input in `scripts/migrations/`. It runs once on the server during deploy, snapshots `content/before-<id>/`
  first, and is recorded in `content/.migrations.json`. Never edit or reorder old migrations.
- **New field**: add it to `blankTour()` / `blankReview()` in `lib/content.js`. The bot keeps unknown fields.
- Redirect map for renamed/retired tours: `data/tour-redirects.json` (read by the server on every request).

## UI engine contracts (markup can change; contracts must not)
- **Catalog filters** (`public/tours-render.js` + `Cards.catalogToolbar` in `public/cards.js`): the server renders the
  toolbar; one delegated click handler reacts to `[data-f]` (category), `[data-t]` (tags, AND), `[data-clear]`,
  `[data-fsort]`. Redesign = new markup with the same data-attributes, not a fork of the logic.
- **`nav.js`** markup is put into every page by the server (`withChrome` in `lib/pages.js`).
- **Tour page** (`lib/tour-page.js`): one `.tour-tabs` block serves phones (tabs) and desktop (stacked sections).
- **Shared atoms**: `.tour`, `.chip`, `.btn`, tokens (`--grad-surface`, `--hairline`, `--aurora`): touching them =
  spot-check home, tours, blog.
- **Viewport separation** (owner's hard rule): base CSS = desktop, mobile overrides inside `@media(max-width:680px)`.

## Regression guard (before saying "done")
1. `npm test`; `npm run check` against the local server (`node server.js`); for content changes `npm run check:sights`.
2. 375px AND 1280px; light AND dark theme; console clean; no horizontal overflow.
3. Touched shared atoms? Check the other pages using them.
4. Commit per stable feature. Breakage = `git revert`.

## Deploy
- Push to `main` (only the owner pushes) → GitHub Actions job `test` (site + partners tests) → job `deploy` over SSH:
  `git reset --hard`, `npm ci --omit=dev`, `node scripts/migrate.js`, `node scripts/regenerate-all.js`, `pm2 reload`.
- Rehearse risky releases first and follow `seo-audit/deploy-checklist.md`; after deploy run
  `node scripts/check-site.js https://azattours.com`.
- Server settings that are not in git (nginx HTTP/2, monitoring): `docs/SERVER.md`.

## Debugging quick table
| Symptom | Likely cause |
|---|---|
| Change not visible on site | template/data cache keys on mtimes: check the file really changed on the server; HTML is `no-cache` |
| Bot edit reverted my feature | the feature lived only in `public/*-data.js`, not in `content/*.json` (needed a migration) |
| Old URL gives 404 instead of 301 | slug missing in `data/tour-redirects.json` |
| Filter control does nothing | missing `data-f`/`data-t` or container not in the delegated selector |
| Image without a resized copy | `sharp` missing on the server or the source is already narrower than the width asked |
