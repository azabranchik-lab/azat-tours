// Reproducible source for the six "Travelling with us" blog posts (one per
// homepage .why-card). content/posts.json is gitignored and server-owned, so
// THIS file is what survives in git and re-creates the posts anywhere.
//
// Usage:
//   node scripts/add-why-posts.js            adds any of the six that are missing
//   node scripts/add-why-posts.js --update   also refreshes body/excerpt/author of
//                                            existing ones to this file's versions
//                                            (covers/dates/ids are left alone: the
//                                            owner may have changed covers via the bot)
//
// 2026-07-23: bodies expanded from ~220 to 800+ words each (SEO audit: thin
// content), author unified to Azat (stock avatars removed), facts synced with
// plan-trip.html (visa 30 days, BSZ, som rate, altitude, insurance).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = path.join(ROOT, 'content', 'posts.json');

const COVER = {
  guides: 'img/blog/local-guide-eagle.jpg',
  tailor: 'img/blog/tailor-made-trips.jpg',
  safety: 'img/blog/safety-in-the-mountains.jpg',
  community: 'img/blog/community-tourism.jpg',
  abroad: 'img/blog/easy-arrival.jpg',
  pricing: 'img/blog/fair-honest-pricing.jpg',
};
const CAT = 'Travelling with us';
const AUTHOR = 'Azat, founder & guide';

const posts = [
  {
    id: 1009, slug: 'real-local-guides', category: CAT, date: '2026-04-28',
    title: 'Why a real local guide changes the whole trip',
    excerpt: 'Not a script-reading rep, a Kyrgyz guide who knows the passes, the families and the safe river crossings.',
    author: AUTHOR, authorImg: '', cover: COVER.guides,
    body: `On paper, a guide is a guide. In the mountains of Kyrgyzstan, the difference between a local one and the rest is the difference between watching a country and being let into it.

## We grew up in these mountains

Our guides are Kyrgyz. We learned these valleys on horseback before we ever called it work, which pass clears first in summer, which family keeps a yurt by which lake, which river is calm in the morning and dangerous by afternoon.

That kind of knowledge does not come from a training course. It comes from moving sheep up to the jailoo as a kid, from riding to a neighbour's camp for tea, from being caught out by mountain weather enough times to respect it. I have been guiding since 2019, and the honest truth is that most of what makes a trip work I learned long before that.

[img:img/blog/body/guide-riders.jpg|A pass looks different to someone who has crossed it a hundred times.]

## What a local guide actually does for you

- Reads the weather and the passes, and changes the plan when the mountains say so
- Knows which river crossing is safe today, not in general
- Speaks Kyrgyz and Russian, so doors, and yurts, open
- Knows the families along the route, because we have been stopping at the same camps for years
- Turns a viewpoint into a story, and a stranger's tent into tea and bread

## A day with a guide, hour by hour

Say we are riding toward Song-Kol. Before breakfast your guide has already looked at the sky, felt the wind and decided whether today is the day for the pass or the day for the lakeshore. Over tea he tells you the plan, and why. On the trail he rides where he can see everyone, adjusts stirrups, swaps horses if a pairing is not working. At the river he goes first. In the evening he is the one talking with the host family in Kyrgyz, which is why dinner can end in stories and laughter around the stove, not with a bill.

None of that shows up on an itinerary PDF. All of it is the trip.

## The doors a local opens

Kyrgyz hospitality is real, but it opens fully when someone the family trusts makes the introduction. Arriving with a local guide means you are a guest, not a customer. You notice it in small things: the seat you are given, the questions you are asked, the bowl of kymyz (fermented mare's milk, the jailoo welcome drink) offered whether you asked for it or not.

This matters even more at the remote camps. The herders we stay with are our partners year after year, and that relationship is the reason the welcome feels nothing like a hotel check-in. More on how that works in [where your money stays](post.html?slug=community-tourism).

## Local knowledge is a safety system

The most useful safety equipment in these mountains is judgement. Weather shifts fast above 3,000 m, rivers rise through the day as snow melts, and a pass that was fine on Tuesday can be a bad idea on Wednesday. A guide who grew up here makes those calls early and calmly, long before they become problems. The whole system, vehicles, first aid, satellite comms, is in [how we look after you](post.html?slug=safety-in-the-mountains).

## Horses matched to riders

If your trip involves horses, your guide is also the one matching each horse to each rider. Complete beginners get the steady characters and a gentle first day; confident riders get horses that like to move. Nobody gets a surprise. It is why people who have never ridden finish a multi-day trek feeling like they gained a skill, not survived an ordeal.

[tip:Ask us anything|Your guide is the same person before, during and after the trip, message us and a real local answers, not a call centre.]

> Travellers always say the same thing at the end: the mountains were unforgettable, but it was the people who made it home.

This is the whole idea behind Azat Tours. "Azat" means free in Kyrgyz, and we want you to feel free here, and at home.

## Meet them on the trail

Our guides shine brightest on the long rides: a full week in the saddle on the [horseback riding tour (7 days)](tour.html?slug=kyrgyzstan-horseback-riding-tour-7-days), far off the map on the [untouched mountains ride (6 days)](tour.html?slug=untouched-mountain-horse-riding-tour-6-days), or the big mix of riding and trekking from [Song-Kol to Ala-Kol (7 days)](tour.html?slug=song-kol-to-ala-kol-horse-riding-trekking-7-days).`
  },
  {
    id: 1008, slug: 'tailor-made-trips', category: CAT, date: '2026-04-26',
    title: 'Tailor-made by default: your trip, your pace',
    excerpt: 'Tell us your dates, pace and budget. We design an itinerary that fits you, not rigid package tourism.',
    author: AUTHOR, authorImg: '', cover: COVER.tailor,
    body: `We don't sell seats on a fixed conveyor belt. Every trip we run starts from a blank page and three questions: when can you come, how hard do you want to walk, and what do you actually want to feel?

## No two travellers are the same

A family with kids, a couple who want long days in the saddle, a photographer chasing light, the same region, three completely different trips. Our published tours are a starting point, not a cage.

## The questions behind the questions

"When can you come" is really a season question: July means green jailoo and lively camps, September means golden light and quiet trails. "How hard" is an honesty question: four hours in a saddle feels very different from four hours on a sofa, and there is no prize for suffering on holiday. "What do you want to feel" is the one that shapes everything. Some people come for the wide-open silence, some for the horses, some for the family table in a village. Tell us that, and the route almost draws itself.

## How tailoring works, step by step

- Tell us your dates, pace and budget, roughly is fine
- We reply within 24 hours with a route that fits the season and your time
- We adjust together until it feels right: add a rest day, swap a trek for a horse ride, trade a hotel night for a yurt night
- You travel privately or in a small group, and the plan stays flexible on the ground

## Say you have nine days

Here is how the thinking goes. Nine days in July with two riders who want saddle time: we build around Song-Kol, ride camp to camp for the middle stretch, and keep the first and last days light for arrival and the flight home. The same nine days with two kids under ten becomes a different trip: shorter drives, guesthouses with warm showers, a gentle one-day ride instead of a five-day trek, more time at the Issyk-Kul shore. Same country, same length, built around different people.

## What we can change, and what we cannot

Honesty works both ways, so here is the other side. We can shape pace, comfort level, activities and route order almost endlessly. We cannot change the mountains: high passes open roughly June to September, Song-Kol yurt camps fold in early October, and some drives are simply long because Kyrgyzstan is big. If your dates fall outside the season for the thing you want most, we will say so and offer the honest alternative. The full season picture is in [when to visit](post.html?slug=best-time-to-visit-kyrgyzstan).

## Changes on the ground

Tailoring does not stop when the trip starts. Your guide checks in as you go: sleeping well in the yurt, or want a guesthouse tomorrow? Legs tired, or ready for the longer trail? We build routes with slack in the right places precisely so these choices exist. If the group falls in love with a lake, we can often stay the extra night and shorten a drive later. The plan is a tool, not a contract carved in stone.

## Private or small group

Most tailored trips run privately: you, your people, your guide and driver. If you would rather share the road and the campfire, tell us, small groups happen when travellers with similar plans and dates combine. Either way the group never gets big, because half of what we offer is flexibility, and flexibility dies at bus scale.

[tip:Free to ask|Planning is free and there's no prepayment. We only want you on a trip that's right for you.]

## What it costs

A tailored trip is not automatically an expensive one. The price follows your choices: season, group size, comfort level, activities. A September trip in guesthouses costs less than a July trip with a full camp crew. We quote transparently and itemise what is included; the whole approach is in [fair, honest pricing](post.html?slug=fair-honest-pricing).

> The best itinerary isn't the one with the most stops. It's the one that still has room to say "let's stay here another night."

Send us a rough idea and we'll turn it into a real plan within 24 hours.

## Start shaping yours

Use the [trip builder](builder.html) to sketch your dates and interests, or take a base like the [Best of Kyrgyzstan (12 days)](tour.html?slug=best-of-kyrgyzstan-12-days) and bend it to fit. Short on time? [Kyrgyzstan in a week (7 days)](tour.html?slug=kyrgyzstan-in-a-week-7-days) packs the icons into seven days, and most of our routes exist in several lengths, so the days can flex too.`
  },
  {
    id: 1007, slug: 'safety-in-the-mountains', category: CAT, date: '2026-04-24',
    title: 'Safety first: how we look after you in the mountains',
    excerpt: 'Vetted vehicles, first-aid-trained guides, satellite comms in remote areas and a 24/7 team back in Bishkek.',
    author: AUTHOR, authorImg: '', cover: COVER.safety,
    body: `Kyrgyzstan's mountains are wild in the best way, high passes, remote valleys, real rivers. We love that. It's also exactly why safety isn't an afterthought for us; it's built into how every trip runs.

## Two different kinds of safe

First, the country itself. Kyrgyzstan is one of Central Asia's most stable and welcoming destinations, rated Level 1 by the US State Department, "exercise normal precautions", and solo and women travellers consistently find it comfortable. Crime against visitors is rare; in Bishkek the advice is the same as in any city, watch your pockets in busy spots like Osh Bazaar.

The real risks here are different: weather, altitude, rivers and long mountain roads. Those are exactly the risks a good operator can manage, and that is what the rest of this page is about. The country-level picture lives in our [travel guide](plan-trip.html#safety).

## Safety starts at the planning table

The cheapest place to fix a problem is before it exists. When we design your route we match it to your actual fitness and riding experience, not to how the photos look. If a route is wrong for your group we say so and propose the version that fits, that is half the value of [tailoring](post.html?slug=tailor-made-trips). We also build weather slack into itineraries in the seasons that need it, so a stormy day costs you a view, not the whole plan.

## On the road

- Vehicles are checked and maintained, no tired vans on mountain switchbacks
- Drivers know these roads in every season, including which stretches to take slowly
- Distances are planned honestly: we would rather add a stop than push a driver through a marathon day

## On the trail

- Guides are first-aid trained and carry a kit
- In remote areas we carry satellite communication, because phone signal disappears up high
- Routes build in acclimatisation, and we make honest calls: if a pass isn't safe today, we wait or reroute

[tip:The "is today a good day?" call|Weather and rivers change fast. A local guide making that decision is the single biggest safety factor on any trek.]

## Altitude, respected

Much of what you came to see sits above 3,000 m: Song-Kol's pastures, Ala-Kol's turquoise water at 3,560 m, passes near 3,900 m. Altitude is not something to fear, it is something to respect with time. Our higher routes climb gradually, first days stay moderate, and your guide watches how everyone feels. Your part: drink more water than feels necessary, tell your guide early if your head aches, and do not treat day one as a race. The full health picture, including why travel insurance with mountain cover is required on our tours, is in the [guide](plan-trip.html#health).

## Rivers and horses

Mountain rivers rise through the day as snow melts, so a crossing that was easy at nine can be serious at four. Local guides plan crossings for the right hour and go first. On horse treks, every rider gets a horse matched to their level, beginners get the calm veterans, and the first hours are gentle on purpose. The horses know these trails better than any of us.

## Small things that matter

- Drink bottled or treated water when off-grid; we keep supplies stocked
- Sun at altitude is stronger than it feels: high-SPF sunscreen and a hat are not optional
- Shepherd dogs guard the herds along some trails; your guide knows how to pass them calmly
- Mountain weather does all four seasons in a day, pack layers, the [packing list](plan-trip.html#packing) has details

## Someone is always reachable

There's a 24/7 support team back in Bishkek for the whole trip, for you and for the people at home. Remote camps have satellite contact, so "off the grid" never means "out of reach".

## What we ask of you

Safety is a partnership, so we ask a few things in return: be honest about fitness and health when we plan (there is no wrong answer, only wrong routes), bring travel insurance with mountain cover, and listen to your guide on the trail, especially about rivers, weather and altitude.

> Adventure and safety aren't opposites. Done right, feeling safe is what lets you actually relax and enjoy the wild.

## Comfortable first steps

If you want the mountains with a soft landing, the [family tour (4 days)](tour.html?slug=kyrgyzstan-family-tour-4-days) and the gentle [Discover Kyrgyzstan road trip (7 days)](tour.html?slug=discover-kyrgyzstan-7-days) keep the wild scenery and skip the hard passes. Ready for the classic high trek instead? Read the [complete Ala-Kol guide](post.html?slug=ala-kol-trek-guide) first.`
  },
  {
    id: 1006, slug: 'community-tourism', category: CAT, date: '2026-04-22',
    title: 'Community tourism: where your money stays',
    excerpt: 'We partner with herder families and village hosts, so your money stays in the mountains it came from.',
    author: AUTHOR, authorImg: '', cover: COVER.community,
    body: `Tourism can either drain a place or feed it. We've chosen the second one, on purpose, and from the start.

## Who you actually stay with

When you sleep in a yurt by Song-Kol or eat a home-cooked dinner in a village, that's a real family's home and livelihood, not a chain. We work with herder families and village hosts directly.

The rhythm behind it is old. Every May, families move their animals up to the jailoo, the high summer pastures, and set up camp; every September they come back down. Hosting a few travellers fits into that life without replacing it. The horses you ride are working horses, the milk in your tea came from the herd outside, and the family's year still turns around the animals, not around tourism.

[img:img/blog/body/summer-pasture.jpg|Summer pastures come alive when families move up with their animals, and a few guests.]

## What "direct" actually means

No layers. We agree terms with the families themselves, season by season, and pay them directly for every guest night and every meal. Our guides and drivers are local, hired here and paid here. We won't dress that up with invented percentages, we simply built the company so there is no chain of resellers between your payment and the people doing the work.

## The other model, briefly

You have seen it elsewhere: tours sold abroad, profits landing abroad, locals cast as scenery. The mountains end up with the litter and not much else. We are not neutral about this, we live here. Azat Tours exists partly so that the money Kyrgyzstan's mountains attract actually reaches the mountains, and every booking is a small vote for that model.

## Why it matters

- Your payment reaches the families and guides doing the work
- Income stays in mountain villages, helping them keep the nomadic way of life alive
- Young people get a reason to stay in the valleys instead of leaving for the city
- You get something no resort can sell: a genuine welcome

## What a stay is actually like

Expect a felt-lined yurt, thick blankets, a table that fills with bread, jam, cream and tea the moment you sit down, and a silence at night you may never have heard before. Comfort is real but honest: beds are warm, the toilet is usually a short walk away, showers are a town thing. We wrote a whole guide to it, [staying in a yurt](post.html?slug=yurt-culture-etiquette), including the etiquette that makes hosts light up.

## Small groups, on purpose

A yurt camp can host a handful of guests without changing what it is. A bus cannot arrive at a family camp without turning it into a stage. That is one of the quiet reasons we keep groups small: it keeps the exchange human on both sides, and it is why the welcome you get is real rather than rehearsed.

[tip:Be a good guest|A small gift, sweets for the kids, or tea, and a little curiosity go a long way. Hospitality here is an honour, not a transaction.]

## How to leave a place better

- Carry your litter down, everything you pack in comes back out
- Ask before photographing people, a smile and a gesture is enough
- Buy local where you can: felt crafts, honey, kurut (the salty dried-yoghurt balls you will be offered on every jailoo, accept at least one, they grow on you)
- Learn three words of Kyrgyz, "rakhmat" (thank you) opens more doors than you would think
- Respect the water: streams here are drinking water for people and herds

## When to come

The full jailoo experience runs May to September, while families are up on the pastures; July and August are the liveliest. September is quieter and golden, and the last camps at Song-Kol fold in early October. The season-by-season picture is in [when to visit](post.html?slug=best-time-to-visit-kyrgyzstan).

> "A guest brings happiness," goes the Kyrgyz saying. Travel here in a way that leaves the place better, and you'll feel the difference both ways.

## Trips built around local homes

The [authentic road trip (8 days)](tour.html?slug=authentic-road-trip-tour-8-days) sleeps in family guesthouses and nomad camps most tours never reach, the [untouched mountains ride (6 days)](tour.html?slug=untouched-mountain-horse-riding-tour-6-days) stays with herders the whole way, and the short [Song-Kol on horseback (3 days)](tour.html?slug=song-kol-lake-on-horseback-3-days) is the classic first taste of jailoo life.`
  },
  {
    id: 1005, slug: 'easy-from-abroad', category: CAT, date: '2026-04-20',
    title: 'Easy from abroad: visas, arrival and logistics',
    excerpt: 'Visa-free for most Western and East-Asian passports. We help with airport pickup, SIM cards, logistics and everything in between.',
    author: AUTHOR, authorImg: '', cover: COVER.abroad,
    body: `Kyrgyzstan is far easier to visit than most people expect. Half the worry of a trip is the getting-there part, so we take that off your plate.

## Visas: simpler than you think

Travellers from the EU, UK, USA, Canada, Australia, New Zealand, Japan and South Korea enter visa-free for **up to 30 days within any 60-day period**. This changed at the end of 2025, and plenty of older guides online still say 60 days, so check your own nationality on evisa.e-gov.kg (rules checked July 2026). Staying longer? The online Sapar e-visa covers up to 90 days. Tell us your passport and we'll confirm exactly what applies to you.

For a one- or two-week trip, which is what most of our travellers do, the honest summary is: with most Western and East-Asian passports there is nothing to arrange at all. Land, get stamped, start.

## Getting here: one stop, usually

There is no single long-haul hub into Bishkek yet, so nearly everyone connects once. The common routes:

- Istanbul (Turkish Airlines, Pegasus), the busiest option from Europe and the Americas
- Dubai (flydubai) from the Gulf and beyond
- Almaty (Air Astana) from much of Asia
- Osh (OSS) in the south, handy if your route starts near the Pamir or the Fergana valley

Flying long-haul into Almaty in Kazakhstan and crossing overland is sometimes cheaper; the border is a 3 to 4 hour drive from Bishkek. It is not for everyone, ask us and we will tell you honestly whether it makes sense for your route.

[tip:Just land|Most travellers arrive into Bishkek (Manas, code BSZ since August 2025, formerly FRU). Send us your flight and someone will be waiting with your name.]

## We meet you at the airport

- Airport pickup, day or night, long-haul connections tend to land at unfriendly hours and we plan for it
- A local SIM card so you're connected from the start
- Help with city logistics, money and your first night

Arrival night is part of the trip design, not an afterthought: if you land at 4 a.m., the first day's plan respects that, breakfast late, start gently.

## Money, without the guesswork

The currency is the Kyrgyz som, around 87 to 90 to the US dollar in 2026. The working rules:

- Cards work in Bishkek hotels and supermarkets, rarely in villages
- Carry cash for the mountains; ATMs live in cities and towns, mostly take Visa, and often cap withdrawals around 20,000 som
- Wise and Revolut cards withdraw som with low fees
- On our multi-day tours most costs are covered anyway, you mainly need cash for drinks, souvenirs and tips (appreciated, never required)

## Staying connected

Cities and main roads have solid 4G; remote camps and high passes have blissful nothing. A local SIM or eSIM costs about 300 to 500 som for plenty of data. Download offline maps before heading up, and warn the people at home that two quiet days at a yurt camp are part of the plan, not a problem. Operator advice is in the [travel guide](plan-trip.html#connectivity).

## What to pack, in one paragraph

Layers, always layers: mountain weather does sun, wind and rain in one afternoon, and evenings are cold even in July. Broken-in boots for treks, a power bank because yurt camps have little electricity, and EU-style sockets (type C/F, 220V) everywhere else. The full list, down to the sleeping-bag liner, is in the [packing guide](plan-trip.html#packing).

## Everything in between

Transfers, domestic logistics, the route, the guesthouses, the guide, it's all arranged before you arrive, so your trip starts the moment you step out of the airport. You will not be negotiating taxis at dawn or guessing which marshrutka goes to the mountains. That is our job.

## Timing your trip

June to September is the headline season, when the high country is open. If your dates are fixed, tell us and we will shape the route to the season; if they are flexible, [when to visit](post.html?slug=best-time-to-visit-kyrgyzstan) breaks the year down month by month.

> You handle the flights. We'll handle Kyrgyzstan.

## Land, ride, done

Both of these start and end in Bishkek and pack the country into one simple loop: [Kyrgyzstan in a week (7 days)](tour.html?slug=kyrgyzstan-in-a-week-7-days) and the faster [express tour (5 days)](tour.html?slug=kyrgyzstan-express-tour-5-days). Questions first? The full [Kyrgyzstan travel guide](plan-trip.html) answers the eight most common ones.`
  },
  {
    id: 1004, slug: 'fair-honest-pricing', category: CAT, date: '2026-04-18',
    title: 'Fair, honest pricing, no hidden extras',
    excerpt: 'Transparent quotes, no hidden extras, and a best-price promise. Enquire free, pay only when you are ready.',
    author: AUTHOR, authorImg: '', cover: COVER.pricing,
    body: `Nobody likes a price that grows after you've said yes. So ours don't.

## What a quote includes

When we send you a price, it's the real one: guide, transport, accommodation, the agreed activities, and most meals on multi-day routes. We spell out what's in and what's not, line by line, so there are no surprises in the mountains. The usual out-of-pocket list is short: drinks, souvenirs and tips, and tips are appreciated, never required.

## Why our tours say "price on request"

Fair question: why not print one big number on every tour page? Because one number would be wrong for most people. The same nine-day route costs different money for two people and for six, in July and in September, in guesthouses and with a full camp crew. A package price has to be padded to cover every case; a personal quote only has to cover yours. So we quote per trip: tell us dates and group, and you get the real number within 24 hours, itemised.

## How a quote is actually built

No mystery. A trip is transport (vehicle, fuel, driver days), guiding, nights (guesthouse, yurt camp, hotel), activities (horses come with their own logistics, a horseman travels with the group), and food. We price each part from current local rates for your dates, and our work carries one margin on top, not a markup at every layer. When you see the itemised quote you can move the sliders yourself: fewer vehicle days, more nights in one place, a different mix of camps and guesthouses.

## How we keep it fair

- Transparent quotes, itemised so you can see where your money goes
- No hidden extras bolted on later: what we agreed is what you pay
- A best-price promise, because we work direct, not through layers of middlemen
- Local economics: our guides, drivers and host families are paid here, fairly, which is leaner than an imported supply chain and better for the valleys, see [where your money stays](post.html?slug=community-tourism)

[tip:No prepayment to ask|Enquiring is free and you don't pay to plan. You only commit when the trip is right.]

## Tell us your budget, really

The most useful sentence in trip planning is an honest budget. For us it is not a negotiating position, it is a design constraint. Tight budget? September dates, guesthouses over camps, or a shorter variant of the same route, most of our routes exist in several lengths, the [ultimate road trip](tour.html?slug=kyrgyzstan-ultimate-road-trip-7-days) alone runs from 7 to 12 days. Room to spare? We will tell you where extra money genuinely buys a better trip, a rest day, a more comfortable vehicle for the long drives, and where it would just buy padding.

## What "no hidden extras" means in practice

Changes on the ground happen: weather closes a pass, the group falls in love with a lake. When plans shift, we talk about any cost difference before it happens, not on the last evening. If a change saves money, that comes back to you too. The rule is boring and simple: no surprises in either direction.

## Currency and paying

Quotes come in US dollars because that is what most travellers compare in; on the ground the currency is the Kyrgyz som, about 87 to 90 to the dollar in 2026. How and when to pay is agreed per trip, and enquiring costs nothing, there is no deposit just to hold a conversation. The practical money side of travelling here, cash, cards, ATMs, tipping, is covered in the [travel guide](plan-trip.html#money).

## Tailored, not inflated

Because every trip is custom, the price reflects your group size, season and choices, not a padded package rate. And value here is honest to both sides: fair for you, and fair for the families and guides doing the work. Cheap at someone else's expense is not a deal we sell.

> Fair pricing is really just respect. Tell us your budget honestly and we'll tell you honestly what's possible.

## See it in practice

Every tour page lists exactly what's included, day by day: compare the [ultimate road trip (9 days)](tour.html?slug=kyrgyzstan-ultimate-road-trip-9-days) with the compact [Active Kyrgyzstan (5 days)](tour.html?slug=active-kyrgyzstan-5-days) and you'll see the same open approach on both.`
  },
];

const UPDATE = process.argv.includes('--update');
const data = JSON.parse(fs.readFileSync(P, 'utf8'));
let added = 0, updated = 0;
for (const post of posts) {
  const existing = data.find(p => p.slug === post.slug);
  if (existing) {
    if (UPDATE) {
      // Refresh the text, keep server-owned presentation (cover/date/id/images)
      existing.body = post.body;
      existing.excerpt = post.excerpt;
      existing.author = post.author;
      existing.authorImg = post.authorImg;
      updated++;
      console.log('updated:', post.slug);
    } else {
      console.log('skip (exists):', post.slug);
    }
    continue;
  }
  data.push({ ...post, images: [] });
  added++;
}
fs.writeFileSync(P, JSON.stringify(data, null, 2));
require('../lib/content').regeneratePostsFile();
console.log(`Added ${added}, updated ${updated}; total ${data.length}. Regenerated posts-data.js`);
