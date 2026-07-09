---
name: site-logic
description: Information architecture and user flows of the Azat Tours site — page roles, navigation rules, where each page leads, no dead ends. Use when adding/removing pages or sections, changing navigation/links/CTAs, deciding where content belongs, or when the owner asks about структура, логика сайта, навигация, куда ведёт.
---

# Site logic — information architecture and flows

## When to use
Before adding/moving/removing any page, section, link, or CTA. Also when something feels "lost"
(user can't find X) or when deciding WHERE new content should live. Pairs with `ux-laws` (how it
looks) and `sales-funnel` (how it converts).

## Page roles (each page has ONE job)
| Page | Role | Primary next step |
|---|---|---|
| `index.html` | Hub/showcase: orient + route by interest | Build your trip / Browse tours / category deep-links |
| `tours.html` | Choose: filter/sort/compare 39 tours | Open a tour |
| `tour.html?slug=` | Convince: full story of one trip | Send enquiry / WhatsApp |
| `builder.html` | Convert (active): assemble a custom trip | Submit lead |
| `plan-trip.html` | Convert (guided): tailor-made hub | Form / WhatsApp |
| `blog.html` + `post.html` | Attract (SEO) + build trust | Linked tours, plan-trip |
| `about.html` | Trust: founder story, team, mission | Tours / plan-trip |
| `contact.html` | Support: reach a human | WhatsApp / form |
| `reviews.html` | Social proof — HIDDEN until real reviews exist | (returns with real reviews) |

New content must map to exactly one role. If it serves two, split it or pick the dominant one.

## The main flow (protect it)
Land (SEO/social/direct) → Orient (hero: what/for whom, ≤3s) → Choose (catalog: filter/sort,
scannable cards with hook+meta) → Convince (tour page: itinerary, sights, photos, practical tabs)
→ Act (enquiry form / WhatsApp — low friction, no prepayment) → Reply ≤24h (leads land in the
Telegram bot) → Post-trip: ask for a review (via bot) → review feeds social proof.

Rules that keep the flow intact:
- **No dead ends.** Every page ends with a next step (related tours, CTA, footer nav). The
  no-results state in the catalog offers "Request a custom trip" — keep that pattern everywhere.
- **Where am I / what can I do / where next** must be answerable on every screenful.
- **One primary CTA per view**; secondary actions visually quieter (Von Restorff).
- Don't link to the page the user is already on (removed sticky "Tours" on tours — same logic).
- Every entry point works standalone: deep-links `?cat=Horse riding` (home cards → filtered
  catalog), `tour.html?slug=` (ads/social → tour) must orient without prior context (breadcrumb,
  clear H1).

## Navigation invariants (architecture of links)
- `nav.js` is the SINGLE source of header, mobile menu, footer, floating CTAs — injected by
  `<body data-page="...">`. Changing nav/footer/CTA = edit `nav.js` once, never per-page HTML.
  `builder.html` intentionally has its own minimal chrome (no data-page).
- Per-page config in `nav.js` `CFG`: active nav item, header CTA, `mcta` (mobile sticky bar).
  Tours and tour pages have `mcta:false` deliberately.
- Footer is a secondary sitemap: tour categories (with `?cat=` deep-links), company pages, contact.
  Keep it complete when pages are added/renamed.
- Breadcrumbs on subpages (`Home / Tours`); hidden on mobile tour hero deliberately (space).

## Content relationships (cross-linking logic)
- Tour → related tours: same category first, current excluded (in `tour-detail.js`).
- Blog post → 2-3 relevant tours (contextual links in body); the 6 "why us" home cards → 6 posts.
- Home "Top places" tiles → catalog (could deep-link to filtered views later).
- Sights carousel on tours (bot-editable `content/sights.json`) reuses across tours by place key.

## Apply to THIS project
- Adding a page: assign role + next step, add to `nav.js` (NAV/CFG/footer), sitemap.xml, and give
  it `data-page` so chrome injects; verify at 375/1280.
- Removing/renaming: update `nav.js`, footer, sitemap, internal links; never leave orphans.
- Before approving any new section ask: whose job is this page, does the section serve that job,
  and what is the user's next step from it?
