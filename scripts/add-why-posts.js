// One-off: add 6 "why travel with us" blog posts (one per homepage .why-card) and
// regenerate posts-data.js. Idempotent — skips slugs that already exist.
// Usage: node scripts/add-why-posts.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = path.join(ROOT, 'content', 'posts.json');

const COVER = {
  guides: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1100&q=75',
  tailor: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1100&q=75',
  safety: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1100&q=75',
  community: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1100&q=75',
  abroad: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1100&q=75',
  pricing: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1100&q=75',
};
const AV = {
  azat: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&q=80',
  azamat: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
  cholpon: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80',
};
const CAT = 'Travelling with us';

const posts = [
  {
    id: 1009, slug: 'real-local-guides', category: CAT, date: '2026-04-28',
    title: 'Why a real local guide changes the whole trip',
    excerpt: 'Not a script-reading rep — a Kyrgyz guide who knows the passes, the families and the safe river crossings.',
    author: 'Azamat, lead guide', authorImg: AV.azamat, cover: COVER.guides,
    body: `On paper, a guide is a guide. In the mountains of Kyrgyzstan, the difference between a local one and the rest is the difference between watching a country and being let into it.

## We grew up in these mountains

Our guides are Kyrgyz. We learned these valleys on horseback before we ever called it work — which pass clears first in summer, which family keeps a yurt by which lake, which river is calm in the morning and dangerous by afternoon.

[img:${COVER.safety.replace('w=1100','w=1100')}|A pass looks different to someone who has crossed it a hundred times.]

## What a local guide actually does for you

- Reads the weather and the passes, and changes the plan when the mountains say so
- Knows which river crossing is safe *today*, not in general
- Speaks Kyrgyz and Russian — so doors, and yurts, open
- Turns a viewpoint into a story, and a stranger's tent into tea and bread

[tip:Ask us anything|Your guide is the same person before, during and after the trip — message us and a real local answers, not a call centre.]

> Travellers always say the same thing at the end: the mountains were unforgettable, but it was the people who made it home.

This is the whole idea behind Azat Tours — *azat* means "free" in Kyrgyz, and we want you to feel free here, and at home.`
  },
  {
    id: 1008, slug: 'tailor-made-trips', category: CAT, date: '2026-04-26',
    title: 'Tailor-made by default: your trip, your pace',
    excerpt: 'Tell us your dates, pace and budget. We design an itinerary that fits you — not rigid package tourism.',
    author: 'Azat, founder', authorImg: AV.azat, cover: COVER.tailor,
    body: `We don't sell seats on a fixed conveyor belt. Every trip we run starts from a blank page and three questions: when can you come, how hard do you want to walk, and what do you actually want to feel?

## No two travellers are the same

A family with kids, a couple who want long days in the saddle, a photographer chasing light — the same region, three completely different trips. Our published tours are a starting point, not a cage.

## How tailoring works

- Tell us your dates, pace and budget
- We propose a route and adjust until it fits — add a rest day, swap a trek for a horse ride, slow it down
- You travel privately or in a small group; the plan stays flexible on the ground

[tip:Free to ask|Planning is free and there's no prepayment. We only want you on a trip that's right for you.]

> The best itinerary isn't the one with the most stops. It's the one that still has room to say "let's stay here another night."

Send us a rough idea and we'll turn it into a real plan within 24 hours.`
  },
  {
    id: 1007, slug: 'safety-in-the-mountains', category: CAT, date: '2026-04-24',
    title: 'Safety first: how we look after you in the mountains',
    excerpt: 'Vetted vehicles, first-aid-trained guides, satellite comms in remote areas and a 24/7 team back in Bishkek.',
    author: 'Azamat, lead guide', authorImg: AV.azamat, cover: COVER.safety,
    body: `Kyrgyzstan's mountains are wild in the best way — high passes, remote valleys, real rivers. We love that. It's also exactly why safety isn't an afterthought for us; it's built into how every trip runs.

## On the road

- Vehicles are checked and maintained — no tired vans on mountain switchbacks
- Drivers know these roads in every season

## In the mountains

- Guides are first-aid trained and carry a kit
- In remote areas we carry satellite communication, because phone signal disappears up high
- We acclimatise sensibly and make honest calls — if a pass isn't safe today, we wait or reroute

[tip:The "is today a good day?" call|Weather and rivers change fast. A local guide making that decision is the single biggest safety factor on any trek.]

## Someone is always reachable

There's a 24/7 support team back in Bishkek for the whole trip — for you and for the people at home.

> Adventure and safety aren't opposites. Done right, feeling safe is what lets you actually relax and enjoy the wild.`
  },
  {
    id: 1006, slug: 'community-tourism', category: CAT, date: '2026-04-22',
    title: 'Community tourism: where your money stays',
    excerpt: 'We partner with herder families and village hosts, so your money stays in the mountains it came from.',
    author: 'Cholpon, culture guide', authorImg: AV.cholpon, cover: COVER.community,
    body: `Tourism can either drain a place or feed it. We've chosen the second one — on purpose, and from the start.

## Who you actually stay with

When you sleep in a yurt by Song-Köl or eat a home-cooked dinner in a village, that's a real family's home and livelihood — not a chain. We work with herder families and village hosts directly.

[img:${COVER.tailor}|Summer pastures come alive when families move up with their animals — and a few guests.]

## Why it matters

- Your payment reaches the families and guides doing the work
- Income stays in mountain villages, helping them keep the nomadic way of life alive
- You get something no resort can sell: a genuine welcome

[tip:Be a good guest|A small gift — sweets for the kids, or tea — and a little curiosity go a long way. Hospitality here is an honour, not a transaction.]

> "A guest brings happiness," goes the Kyrgyz saying. Travel here in a way that leaves the place better, and you'll feel the difference both ways.`
  },
  {
    id: 1005, slug: 'easy-from-abroad', category: CAT, date: '2026-04-20',
    title: 'Easy from abroad: visas, arrival and logistics',
    excerpt: 'Visa-free for 60+ nationalities. We help with airport pickup, SIM cards, logistics and everything in between.',
    author: 'Azat, founder', authorImg: AV.azat, cover: COVER.abroad,
    body: `Kyrgyzstan is far easier to visit than most people expect. Half the worry of a trip is the getting-there part — so we take that off your plate.

## Visas: simpler than you think

Citizens of **60+ countries** can enter Kyrgyzstan visa-free, many for up to 60 days. Tell us your passport and we'll confirm exactly what applies to you.

## We meet you at the airport

- Airport pickup, day or night
- A local SIM card so you're connected from the start
- Help with city logistics, money and your first night

[tip:Just land|Most travellers arrive into Bishkek (Manas, FRU). Send us your flight and someone will be waiting with your name.]

## Everything in between

Transfers, domestic logistics, the route, the guesthouses, the guide — it's all arranged before you arrive, so your trip starts the moment you step out of the airport.

> You handle the flights. We'll handle Kyrgyzstan.`
  },
  {
    id: 1004, slug: 'fair-honest-pricing', category: CAT, date: '2026-04-18',
    title: 'Fair, honest pricing — no hidden extras',
    excerpt: 'Transparent quotes, no hidden extras, and a best-price promise. Enquire free — pay only when you are ready.',
    author: 'Azat, founder', authorImg: AV.azat, cover: COVER.pricing,
    body: `Nobody likes a price that grows after you've said yes. So ours don't.

## What a quote includes

When we send you a price, it's the real one — guide, transport, accommodation, the agreed activities. We spell out what's in and what's not, so there are no surprises in the mountains.

## How we keep it fair

- Transparent quotes, itemised so you can see where your money goes
- No hidden extras bolted on later
- A best-price promise — because we work direct, not through layers of middlemen

[tip:No prepayment to ask|Enquiring is free and you don't pay to plan. You only commit when the trip is right.]

## Tailored, not inflated

Because every trip is custom, the price reflects *your* group size, season and choices — not a padded package rate.

> Fair pricing is really just respect. Tell us your budget honestly and we'll tell you honestly what's possible.`
  },
];

const data = JSON.parse(fs.readFileSync(P, 'utf8'));
const have = new Set(data.map(p => p.slug));
let added = 0;
for (const post of posts) {
  if (have.has(post.slug)) { console.log('skip (exists):', post.slug); continue; }
  data.push({ ...post, images: [] });
  added++;
}
fs.writeFileSync(P, JSON.stringify(data, null, 2));
require('../lib/content').regeneratePostsFile();
console.log(`Added ${added} posts; total now ${data.length}. Regenerated posts-data.js`);
