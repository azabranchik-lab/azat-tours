---
description: UX/UI + accessibility audit of a page or section, with prioritized fixes (Soft Alpine)
argument-hint: "[page or area, e.g. tours.html mobile, homepage hero, builder]"
---

You are doing a senior UX/UI + accessibility design review of: **$ARGUMENTS**
(if empty, ask which page/section, or default to the page most recently worked on).

This is a REVIEW, not an implementation. Decide-first: report findings and propose fixes; do NOT edit code
unless the user then asks. Be specific and honest — no vague praise.

## How to inspect
1. Read the relevant source (HTML / `tours-render.js` / `styles.css` / `nav.js`) for the target area.
2. Run the app if needed (`node server.js`, port 5173) and inspect with the preview tools at BOTH
   `375px` (mobile) and `1280px` (desktop): `preview_eval`/`preview_inspect`/`preview_snapshot` for DOM,
   computed styles, order, overflow. NOTE: the preview renderer is unreliable for color/theme — judge
   contrast/color from the CSS tokens + a real-browser check, not screenshots.

## Evaluate against (name the principle for each finding)
- **Heuristics (Nielsen):** status visibility, match real world, consistency, recognition over recall,
  error prevention, aesthetic-minimalist. Is the primary action obvious? One primary per view?
- **Visual hierarchy & clarity:** scannability, grouping, whitespace, type scale, is anything cluttered?
- **Accessibility (WCAG):** text contrast ≥ 4.5:1 in BOTH light and dark themes; tap targets ≥ 44px;
  visible focus states; real labels/alt; meaning not by color alone.
- **Responsive:** mobile designed natively (not desktop crammed in); no horizontal overflow at 375px;
  desktop and mobile each coherent; nothing broken between breakpoints.
- **Design language — Soft Alpine (BRAND.md §10):** soft gradients, NO hard 1px divider lines/sharp
  borders, aurora accents, reuse of tokens/components, consistency with the rest of the site.
- **Copy/brand voice:** warm, first-person, concrete; no corporate filler, no em-dashes, no emoji,
  no fake urgency/social proof.
- **Performance/polish:** lazy images, no layout shift, smooth transitions.
- **Project guardrails:** desktop/mobile separation respected; data/deploy nuance (content seeded to server).

## Output format
- Group findings by priority: **P1 (broken / blocks use / a11y fail)**, **P2 (clear UX/quality issue)**,
  **P3 (polish)**. For each: one-line problem → the principle it violates → concrete fix (with `file:line`
  if known). Keep it tight.
- End with **"Fix first"**: the top 3 highest-impact items.
- Then ask if the user wants you to apply any of them (then switch to decide-first implementation).
