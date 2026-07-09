---
name: ux-laws
description: UX laws and usability rules for a clear, convenient site (desktop + mobile). Use when designing or changing any page/section/layout, deciding element placement, spacing, navigation, buttons, forms, or when the owner asks "how should this look / where should this go / is this convenient" (удобно, понятно, расположение, вёрстка).
---

# UX laws — building a clear, convenient site

## When to use
Any user-facing layout/UI decision on the Azat Tours site: new sections, moving elements, choosing
between layouts, sizing controls, forms, navigation. Apply BEFORE coding (decide-first): diagnose with
these laws, propose options, mock the winner.

## Core laws (name them when explaining choices)

| Law | Rule | Practical application here |
|---|---|---|
| Jakob's law | Users expect patterns from other sites | Travel-site conventions: card grids, filters, hero + CTA, sticky nav. Don't invent exotic UI |
| Hick's law | More choices = slower decisions | Trim options: ≤5 categories visible, extra filters behind "Filters", highlights ≤4, one primary CTA |
| Fitts's law | Big/near targets are faster to hit | Tap targets ≥44px on mobile; primary CTA large and reachable; related actions adjacent (Sort next to Filters) |
| Miller / chunking | ~4-7 items per group | Group filter tags (Activity/Duration/Season), itinerary by days, footer in 4 columns |
| Krug: Don't make me think | Every element self-evident | Labels say what happens ("Show 11 tours"), counts on chips, no mystery icons without text |
| Gestalt: proximity/similarity | Near/similar = related | Meta chips grouped under title; consistent chip style = same function everywhere |
| Serial position | First/last items remembered | Most important nav items first and last; key selling point first in blurb hook |
| Von Restorff | The one different item stands out | Exactly ONE teal filled CTA per view; everything else quieter (outline/soft) |
| Doherty threshold | Feedback <400ms | Animations 200-400ms (tourIn is .34s); instant filter counts; never block UI |
| Aesthetic-usability | Beautiful feels more usable | Soft Alpine polish is not decoration, it buys perceived quality — but never at contrast's expense |
| Peak-end rule | Peak + ending shape memory | Tour page: strong gallery peak + friction-free enquiry ending; thank-you state matters |

## Desktop rules (>680px here)
- F/Z scanning: key info top-left → CTA on the scan path. Hero: heading → support text → CTA.
- Above the fold: page purpose + primary action visible without scrolling at 1280x800.
- Text measure ≤75ch; grids 2-4 columns; generous whitespace = grouping tool (cheaper than lines).
- Hover states on every interactive element; visible focus ring (`:focus-visible` teal, already global).
- Sticky header ok; avoid multiple sticky layers stacking.

## Mobile rules (≤680px here)
- Thumb zone: primary actions in the lower 2/3 of the screen or sticky; top corners are dead zones.
- Tap targets ≥44px, gaps ≥8px between targets. No hover-dependent behavior at all.
- Native patterns, not shrunk desktop (owner's hard rule, see memory `mobile-native-design`):
  bottom-sheets for filters, swipe carousels for card rows, single column, compact list-row cards.
- One primary CTA visible per screenful; sticky CTA only when the page has a single dominant action.
- Content order = importance order (no "left column first" thinking).

## Page checklist (run mentally on every changed page)
1. What is this page's ONE job? Is the matching CTA the most prominent element?
2. Can a first-time visitor answer: where am I / what can I do / where next?
3. Heading hierarchy intact (H1 → H2 → H3, no skips; sr-only H2 is fine)?
4. System status visible (live counts, active filter state, form feedback)?
5. Anything clickable that doesn't look clickable, or vice versa?
6. Contrast ≥4.5:1 in BOTH themes; check dark mode too.

## Apply to THIS project
- Design language is Soft Alpine (BRAND.md section 10): soft gradients, no hard 1px lines, aurora
  accents. Reuse `.chip`, `.btn`, `.tour`, tokens (`--grad-surface`, `--hairline`, `--aurora`).
- Desktop and mobile are designed SEPARATELY; a change to one must not leak into the other.
- Decide-first: mock exact placement/alignment/spacing before code (CLAUDE.md operating mode).
- Verify at 375px and 1280px; preview renderer lies about color — judge contrast in a real browser.
