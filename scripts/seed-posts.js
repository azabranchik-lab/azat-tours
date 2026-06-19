// Seeds content/posts.json with the 3 starter articles (markdown-subset body).
// Body markup: blank line = new paragraph; "## " heading; "### " subheading;
// "> " quote; "- " list item; "[img:URL|caption]"; "[tip:Title|Text]"; **bold**.
const C = require('../lib/content');

const U = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1100&q=75`;

const posts = [
  {
    id: 1003, slug: 'ala-kol-trek-guide', title: 'The complete guide to the Ala-Köl trek',
    category: 'Travel guide', excerpt: "Route, difficulty, altitude, packing and tips for Kyrgyzstan's most famous trek — by local guides.",
    author: 'Azamat, lead guide', authorImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
    date: '2026-06-02', cover: U('1551632811-561732d1e306'), images: [],
    body: `Ask any traveller what they remember most about Kyrgyzstan and there's a good chance they'll say one word: Ala-Köl. This glacier-fed lake glows an unreal turquoise at 3,560 m, and reaching it is the country's most loved multi-day trek. Here's everything you need to walk it well.

## Where is Ala-Köl and why go?

Ala-Köl sits high in the Terskey Ala-Too range above Karakol, on the eastern side of Lake Issyk-Köl. The classic route climbs through pine forest and alpine meadow, crosses a 3,900 m pass with jaw-dropping views, then drops to the lake and on to the natural hot springs of Altyn-Arashan.

[img:${U('1454496522488-7a8e488e8606')}|The pass day rewards every step with a panorama over the Tian Shan.]

## How hard is it?

Honestly? It's a proper trek — moderate to hard. You don't need technical skills, but you do need reasonable fitness and the willingness to spend a long day above 3,500 m.

- Distance: ~40–50 km over 3–4 trekking days
- Max altitude: 3,900 m (Ala-Köl Pass)
- Nights: mountain camps and a cosy guesthouse in Altyn-Arashan

## The best time to walk it

The trail is reliably open and snow-light from **mid-June to mid-September**. July and August are warmest and busiest; early September brings golden light and thinner crowds.

[tip:Local tip|Spend a night in Karakol and do a short acclimatisation walk before the pass day. It makes a huge difference to how you feel up high.]

> The lake doesn't look real the first time you see it. People go quiet. Then they start taking a hundred photos.

## Can I do it independently?

You can, and some do. But weather windows, river crossings and the pass demand respect, and there's no phone signal up there. A local guide handles logistics, permits, food and the all-important "is today a good day for the pass?" call — so you can simply enjoy it.`
  },
  {
    id: 1002, slug: 'best-time-to-visit-kyrgyzstan', title: 'When is the best time to visit Kyrgyzstan?',
    category: 'Planning', excerpt: 'Month-by-month: when to trek, ride, see the lakes or ski in Kyrgyzstan.',
    author: 'Aizada, trip planner', authorImg: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&q=80',
    date: '2026-05-20', cover: U('1464822759023-fed622ff2c3b'), images: [],
    body: `Short answer: **June to September** for the mountains, and you won't be disappointed. But Kyrgyzstan has a season for almost everyone — here's how to match your dates to the trip you actually want.

## Summer (June–September): the classic season

This is prime time. High passes are open, the jailoo (summer pastures) are green and dotted with yurts, and herder families move up into the mountains.

- Best for: trekking, horse treks, yurt stays, Issyk-Köl, Kel-Suu
- Weather: warm days, cold nights; afternoon showers possible
- Note: July–August are busiest — book ahead

[img:${U('1486870591958-9b9d0d1dda99')}|Summer is when nomad families move up to the jailoo.]

## Spring & autumn (April–May, October)

The shoulder seasons are underrated. High passes may still be snowy, but the lower valleys, Issyk-Köl shore and cultural sights are beautiful and far quieter.

[tip:Sweet spot|Early September is many guides' favourite — summer access, warm lakes, golden colours and fewer people.]

## Winter (November–March): snow & silence

Winter is for a different kind of traveller. Trekking passes close, but you can ski quiet powder and ride horses to a frozen Song-Köl.

- Best for: skiing, winter yurt stays, photography
- Note: some mountain roads close`
  },
  {
    id: 1001, slug: 'yurt-culture-etiquette', title: 'Staying in a yurt: nomad culture & etiquette',
    category: 'Culture', excerpt: 'The culture behind the Kyrgyz yurt, what to expect, and how to be a respectful guest.',
    author: 'Cholpon, culture guide', authorImg: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80',
    date: '2026-05-08', cover: U('1533105079780-92b9be482077'), images: [],
    body: `A night in a yurt is the moment most travellers fall in love with Kyrgyzstan. It's not a hotel gimmick here — it's a living home that has sheltered nomad families on these pastures for centuries.

## More than a tent

The Kyrgyz **boz üy** is a feat of nomadic engineering: a round lattice frame, a felt cover, and a wooden crown — the tündük — so important it sits at the centre of the national flag.

[img:${U('1506905925346-21bda4d32df4')}|Felt rugs and embroidered textiles turn a frame into a warm home.]

## What a night is really like

Expect comfort that's simple and rich at the same time. You'll sleep on thick felt mattresses under warm blankets, often with a wood stove. Facilities are basic — usually a shared outdoor toilet and limited signal. That disconnection is the point.

- Meals are home-cooked and generous
- You may be offered kymyz (fermented mare's milk)
- Mornings start with the sounds of animals

> "A guest brings happiness," goes the Kyrgyz saying. Hospitality isn't a service here — it's an honour.

## Simple etiquette to be a great guest

- Accept food and tea when offered, even just a little
- Take bread seriously — don't waste it or place it upside down
- Use your right hand to give and receive
- Ask before photographing people
- Dress modestly

[tip:A small gesture|Bringing a little gift — sweets for the kids, or tea — is a lovely way to say thank you.]`
  }
];

C.savePosts(posts);
console.log(`Seeded content/posts.json with ${posts.length} posts and regenerated posts-data.js`);
