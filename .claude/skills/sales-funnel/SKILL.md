---
name: sales-funnel
description: Conversion funnel and honest persuasion psychology for Azat Tours — funnel stages, Cialdini principles within brand honesty limits, CTA and friction rules, lead flow. Use when working on CTAs, forms, selling copy, pricing display, trust elements, or when the owner says продавать, воронка, конверсия, заявки, лиды.
---

# Sales funnel — sell honestly, convert well

## When to use
Any change that affects whether a visitor becomes a lead: CTAs, forms, selling sections, pricing
display, trust signals, follow-up flow. Pairs with `site-logic` (every page's next step) and
`ux-laws` (CTA prominence). For deep copy work also use `marketing-skills:copywriting` +
`anti-ai-copywriting`.

## The funnel (this business, this site)
| Stage | Where | Job | Metric (post-launch) |
|---|---|---|---|
| Attract | SEO/blog/Instagram | Bring the right traffic | Sessions by landing page |
| Engage | Home, catalog | Orient fast, route by interest | Catalog → tour CTR |
| Desire | Tour page | Make the trip vivid + credible | Tour → enquiry rate |
| Action | Enquiry form / WhatsApp / builder | Frictionless first contact | Leads (form vs WA) |
| Follow-up | Telegram bot (leads/chats) | Reply ≤24h, close the sale | Reply time, close rate |
| Post-trip | Bot `/addreview` | Harvest real reviews → social proof | Reviews collected |

The site's ONLY conversion goal is a lead (enquiry or WhatsApp chat) — no online payment yet.
Every selling decision optimizes "qualified lead with low friction", not clicks.

## Persuasion principles (Cialdini) — with the brand's honesty constraint
HARD RULE (BRAND.md): no fake urgency, no invented social proof, no dark patterns. Honesty IS the
selling point ("free to enquire, no prepayment, a real human replies").
- **Social proof**: only real reviews (bot-added; section auto-appears when they exist). Fake stats
  were purged — never reintroduce. Real IG embeds, real Tripadvisor when live.
- **Authority**: local expertise — born here, guiding since 2019, knows the jailoo. Show, not claim:
  concrete route knowledge in blurbs/itineraries.
- **Liking**: founder story (Azat = "free"), first-person voice, real photos of the team.
- **Reciprocity**: free value first — packing lists, honest seasonal advice, "before you go" tabs,
  blog guides. Free trip advice via WhatsApp with zero obligation.
- **Commitment/consistency**: the trip builder is invested effort — a builder lead is a warm lead;
  keep the builder ≤5 easy steps and never lose entered data.
- **Scarcity**: ONLY real scarcity — small groups (true), seasonal windows (Song-Kol June-Sept —
  true). Never countdown timers or fake "2 seats left". Known debt: the "Save 10% before May 31"
  banner on `tour-ala-kul.html` is fabricated urgency — remove/replace when touched.

## Conversion rules for this site
- **One primary CTA per view** (teal `.btn-primary`); secondary quieter. Hero CTAs route by intent:
  Build your trip (active planners) / browse (researchers).
- **Risk reversal near every CTA**: "Free to enquire · No prepayment · Reply within 24h" — this is
  the strongest honest lever we have; surface it at the form, not buried.
- **Friction**: form asks only name/contact/message (+ optional dates); WhatsApp is the lowest-
  friction channel — always offer it next to forms (`.form-wa`); prefilled per-tour WA messages exist.
- **Price "On request"**: compensate with risk reversal + fast reply promise; when real prices
  arrive, show "from $X" (anchor) on cards + detail.
- **Mobile**: CTA reachable in thumb zone; tour pages keep enquiry accessible (nav CTA); don't
  re-add sticky bars the owner removed.
- **Clarity beats cleverness**: CTA labels say the outcome ("Send enquiry", "Build your trip"),
  never "Submit"/"Click here".

## Post-lead (the invisible half of the funnel)
- Leads + site chat land in the Telegram bot (owner replies via Reply / `/chats`). The 24h promise
  is on the site — protect it: any change to lead flow must keep bot notifications working
  (`/api/lead`, rate-limited; see `site-architecture`).
- After a trip: ask for the review (WhatsApp message), add via bot → home reviews section
  auto-appears. This closes the social-proof loop that the site currently lacks.

## Measurement (activate after deploy)
- Add GA4 + basic events: lead_submit (form), wa_click (per placement), builder_complete,
  tour_view. Watch the two big drop points: catalog→tour and tour→lead.
- Until analytics exist, do qualitative checks: no dead ends, CTA above the fold on key pages,
  risk reversal visible at the point of action.
