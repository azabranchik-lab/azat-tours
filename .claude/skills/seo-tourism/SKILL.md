---
name: seo-tourism
description: SEO for a tourism/tour-operator site — search intent, per-page meta, schema.org for trips, E-E-A-T, technical SEO. Use when touching titles/meta/og, writing tour or blog copy for search, adding pages, preparing the pre-deploy SEO pass, or when the owner mentions SEO, Google, поиск, продвижение.
---

# SEO for tourism — Azat Tours

## When to use
Any work on meta tags, schema, sitemap, URLs, or content meant to rank (tour pages, blog posts,
landing sections). Mandatory one full pass BEFORE deploy (CLAUDE.md "SEO timing"). For a generic
technical crawl checklist also consider the global `marketing-skills:seo-audit` skill; this skill
adds the tourism + project specifics.

## Tourist search intent (what people actually type)
- **Transactional:** {destination} + {activity} + {qualifier}: "kyrgyzstan horse riding tour",
  "song kul horse trek 3 days", "kyrgyzstan tour 7 days price", "small group tour kyrgyzstan".
  → tour pages and catalog must carry these combos in title/H1/body naturally.
- **Informational (top of funnel):** "best time to visit kyrgyzstan", "is kyrgyzstan safe",
  "what to pack horse trek", "song kul vs issyk kul". → blog posts; each links to 2-3 relevant tours.
- **Comparison/long-tail** converts best: duration ("in a week"), audience ("family", "beginner"),
  season ("winter"). Our tags (activity/duration/season) mirror this — use tag language in copy.
- One page = one primary query cluster. Don't cannibalize: catalog targets the broad head terms,
  each tour targets its specific combo.

## On-page rules
- **Unique `<title>` (≤60 chars) and meta description (≤160) on EVERY page.**
  KNOWN GAP: `tour.html` and `post.html` are shared templates — one static title/meta for all 39
  tours / all posts. Fix options (in order of strength):
  1. Minimum: JS sets `document.title` + meta description/og from the loaded item (helps Google,
     which renders JS, but weak for other crawlers/social scrapers).
  2. Better: prerender/generate static per-tour HTML at build time (like `*-data.js` generation —
     a `scripts/build-pages.js` emitting `tours/<slug>.html`); best for social og tags too.
- H1 = tour name (already); one H1 per page; headings describe content, not decoration.
- Slugs already descriptive (`best-of-kyrgyzstan-10-days`) — keep; never change published slugs
  without redirects.
- Image `alt` with place names ("Yurts on the shore of Song-Kol lake"), not "photo1".
- Internal linking: blog → tours (contextual, 2-3 per post), tour → related tours (exists),
  catalog deep-links `?cat=` from home cards (exists). No orphan pages.

## Schema.org (JSON-LD)
- Tour page: `TouristTrip` (name, description, itinerary as `ItemList`, provider) — optionally
  `Product`+`Offer` only if a real price is shown ("On request" → skip Offer).
- `BreadcrumbList` on tour/post; `Organization` (or `TravelAgency`) sitewide; `FAQPage` on home FAQ.
- HONESTY RULE (brand): never mark up what doesn't exist — no `aggregateRating` until real reviews
  exist (fake ones were already purged), no fake counts.

## E-E-A-T for travel (Google weighs it heavily)
- Real experience signals: founder story (Azat, guiding since 2019), real team, REAL photos
  (current Unsplash placeholders hurt trust and uniqueness — replace before/at launch).
- Reviews: only genuine (via bot `/addreview`); link Tripadvisor/Google profiles when they exist.
- Contact/NAP consistent: email, WhatsApp number, Bishkek address on contact page + Organization schema.

## Technical
- `sitemap.xml` + `robots.txt` exist but carry the placeholder domain `azattours.travel` — replace
  with the real domain everywhere (~12 files: canonicals, og, sitemap, robots, emails) before deploy.
- Canonical on every page (exists on static pages; per-tour canonical comes with the per-page fix).
- Performance = ranking factor: images lazy-load (done), compress/resize hero images, no layout shift.
- og/twitter cards per page (same gap as titles on tour/post).
- hreflang only when multilanguage actually ships (planned, not yet).

## Apply to THIS project
- Site reads generated `*-data.js`; content lives in `content/*.json` on the server (see skill
  `site-architecture` before adding SEO fields like meta descriptions per tour — they must survive
  the bot and reach the server via seed/merge).
- Blog exists with 9 posts; new SEO posts should follow brand voice (first person, concrete,
  no AI-filler — run `anti-ai-copywriting`) and each must link to tours.
- Verify: view-source shows unique title/meta (not only after JS), schema validates
  (validator.schema.org), sitemap lists real URLs, no placeholder domain remains (`grep azattours.travel`).
