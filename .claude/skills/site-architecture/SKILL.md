---
name: site-architecture
description: How the Azat Tours codebase works and how not to break it — data flow (content/*.json → *-data.js), bot, merge/seed scripts, UI engine contracts, regression guard, deploy runbook. Use before editing code/data/scripts, adding fields, deploying, or when something "didn't update" or "broke" (сломалось, не обновилось, деплой, архитектура).
---

# Site architecture — change things without breaking things

## When to use
Before any non-trivial code change, any data/schema change, any deploy, and when debugging
"why didn't my change show up". This encodes the project's invariants; violating them is the
#1 source of silent breakage and redone work.

## System map
- **Static frontend**: HTML pages + `styles.css` + page scripts (`tours-render.js`,
  `tour-detail.js`, `blog-render.js`, `post-render.js`, `script.js`, `nav.js`, `home-media.js`).
- **`server.js`**: serves the site + lead/chat API (PORT env, default 5173; per-IP rate limits,
  body caps, no wildcard CORS). Local preview: `node server.js` ONLY.
- **`bot.js`**: Telegram admin (grammY). Runs ONLY on the server — starting it locally with the
  same token breaks polling for the live bot. `start.js` runs site+bot together (hosting).
- **Two sources of truth**: code/design = this local folder (then redeploy); content (tours, posts,
  reviews, sights, site media, leads, chats) = the SERVER's `content/*.json`, edited live via bot.

## Data flow (the core invariant)
```
content/*.json  --(lib/content.js regenerate)-->  *-data.js  --(script tag)-->  window.TOURS/SITE/...
   (gitignored, server-owned)                     (committed to git, what the site reads)
```
- **NEVER hand-edit `*-data.js`** — always regenerate via `lib/content.js` (`saveTours()` does both).
- **New/changed content fields** (like `blurb`): reproducible source in `scripts/_*.json` +
  idempotent merge script (model: `scripts/merge-blurbs.js`, `merge-itineraries.js`, `--dry` flag)
  + add the field to `blankTour()` in `lib/content.js` + **run the merge/seed ON THE SERVER at
  deploy** (or upload `content/tours.json`) — otherwise the first bot edit regenerates `*-data.js`
  from the server's json and silently reverts the feature.
- The bot loads the whole array, mutates only the edited field, saves all — so unknown fields
  survive bot edits. Safe to extend the schema.

## UI engine contracts (markup can change; contracts must not)
- **Catalog filter engine** (`tours-render.js`): one delegated click handler listens on container
  selectors and reacts to `[data-f]` (category, single), `[data-t]` (tag, multi, AND),
  `[data-clear]`; state in `activeCat`/`activeTags`; `applyFilters()` + `syncUI()` sync every
  control that carries those attributes. To redesign filter UI: build any markup with those
  data-attributes and add its container to the delegated selector — do not fork the logic.
- **`nav.js`** injects header/menu/footer/floating CTAs from `<body data-page>`; loads BEFORE
  `script.js` (which binds #burger etc. synchronously). Nav changes happen only there.
- **Shared atoms**: `.tour`, `.chip`, `.btn`, tokens (`--grad-surface`, `--hairline`, `--aurora`)
  are used across pages (catalog, home featured, blog cats). Touching them = spot-check home,
  tours, blog. `.chip` has a legacy handler in `script.js` — tour tabs deliberately use their own
  class (`.tour-tabs .tab`); don't reuse `.chip` for non-filter things.
- **Viewport separation** (owner's hard rule): base CSS = desktop, mobile overrides live inside
  `@media(max-width:680px)`; page-scoped rules via `body[data-page="..."]`. A mobile fix must not
  change desktop and vice versa.

## Regression guard (before saying "done")
1. 375px AND 1280px; light AND dark theme (dark via `[data-theme]` toggle).
2. Console clean; no horizontal overflow (`scrollWidth <= innerWidth`).
3. Touched shared atoms? Check the other pages using them.
4. Preview renderer is unreliable for color/animation frames — verify structure via DOM
   (`preview_eval`), judge color/contrast in a real browser.
5. Commit per stable feature (`/code-review` first on non-trivial diffs). Breakage = `git revert`.

## Deploy runbook (VPS, pm2 name `alatoo`)
1. `tar --exclude=kyrgyzstan-tours/node_modules --exclude=kyrgyzstan-tours/config.json
   --exclude=kyrgyzstan-tours/content --exclude=kyrgyzstan-tours/images -czf alatoo-update.tar.gz kyrgyzstan-tours`
2. Unpack over the server copy (server's `content/` + `images/` stay untouched).
   ⚠ The tar ships the LOCAL `*-data.js`; unpacking overwrites the server's regenerated copies, so any
   bot content edits since the last local sync would revert. Therefore ALWAYS regenerate from the
   server's authoritative `content/*.json` right after unpack (before restart):
   `node -e "const C=require('./lib/content');['regenerateDataFile','regeneratePostsFile','regenerateReviews','regenerateGuides','regenerateSite','regenerateSights'].forEach(f=>C[f]&&C[f]())"`
3. `npm install` only if dependencies changed → run any pending seed/merge scripts for NEW content
   fields (see above) → regenerate (step 2) → `node scripts/build-sitemap.js` (sitemap lists every
   tour/post URL from the server's content) → `pm2 restart alatoo`.
4. Pre-prod once: domain is `azattours.com` (real, already used everywhere; no swap needed); rotate the bot token
   (@BotFather) and move to env `BOT_TOKEN`/`OWNER_ID`; never commit `config.json`.

## Debugging quick table
| Symptom | Likely cause |
|---|---|
| Change not visible on site | Edited `content/*.json` but didn't regenerate; or looking at stale cache (data files are no-cache, hard-reload) |
| Bot edit reverted my feature | New field never seeded to the server's `content/*.json` |
| Filter control does nothing | Missing `data-f`/`data-t` or container not in the delegated selector |
| Nav/footer wrong on one page | Wrong/missing `data-page`, or page (builder) intentionally excluded |
| Sticky/position bugs | Check `overflow` on ancestors (body uses `overflow-x:clip` deliberately) |
