// Server-side render of a tour page: <head> data + the full body HTML that used
// to be built in the browser by public/tour-detail.js. The markup and class names
// are unchanged; tour-detail.js now only binds the accordion/tab behaviour.
const { esc, asset, tourUrl, tourFootLeft, FALLBACK_IMG, srcset } = require('../public/cards');
const Reviews = require('./reviews');

const ORIGIN = 'https://azattours.com';
const abs = u => u ? (/^https?:\/\//.test(u) ? u : ORIGIN + '/' + String(u).replace(/^\/+/, '')) : '';

// Meta description: at most 158 characters, never cut mid-word. Ends on a whole
// sentence when that keeps a useful length, otherwise on a word with an ellipsis.
function clipDesc(text, max = 158) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max + 1);
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (end >= 90) return head.slice(0, end + 1);
  return head.slice(0, head.lastIndexOf(' ', max - 1)).replace(/[,;:]$/, '') + '…';
}

// SEO <title>: avoid a double "Kyrgyzstan", keep it ≤60 (name > country hint > brand).
function tourTitle(name) {
  let base = name;
  if (!/kyrgyzstan/i.test(base) && base.length + 12 <= 60) base += ', Kyrgyzstan';
  const withBrand = base + ' | Azat Tours';
  return withBrand.length <= 60 ? withBrand : base;
}

// Per-tour FAQ, generated from real fields (honest, no invented specifics).
// One source for both the visible accordion and the FAQPage schema.
function fmtActivities(a) {
  return String(a).split(',').map(s => {
    const m = s.match(/(.+?)\s*-\s*(\d+)\s*days?/i);
    return m ? m[2] + ' days ' + m[1].trim() : s.trim();
  }).join(' and ');
}
function tourFaqs(t) {
  const out = [];
  const dur = t.duration || (t.days ? t.days + ' days' : '');
  const start = t.start_from || 'Bishkek';
  if (dur) out.push(['How long is this tour?', 'It runs ' + dur + ', starting and ending in ' + start + '.']);
  if (t.season) out.push(['When is the best time to go?', 'The season runs ' + t.season + '. June to September brings the warmest days, and the high-pasture yurt camps are open.']);
  const pace = t.tour_speed ? t.tour_speed.charAt(0).toLowerCase() + t.tour_speed.slice(1) : '';
  if (pace || t.activities) {
    let a = "It's " + (pace || 'an active trip');
    if (t.activities) a += ', with ' + fmtActivities(t.activities);
    a += '. Good general fitness is enough, and there is no technical climbing.';
    out.push(['How fit do I need to be?', a]);
  }
  if ((t.tags || []).indexOf('horseback') >= 0 || /horse|combined/i.test(t.category || '')) {
    out.push(['Do I need horse-riding experience?', 'No. Our guides match each horse to your level and keep the first day gentle, so complete beginners ride this route every season.']);
  }
  if (t.accommodations) out.push(['Where will I stay?', 'A mix over the trip: ' + t.accommodations + '.']);
  if (t.priceFrom > 0) out.push(['How much does it cost?', 'From $' + t.priceFrom + ' ' + (t.priceNote || 'per person') + '. The exact price depends on group size and season, and we confirm it for your group within 24 hours.']);
  return out;
}

// Honesty rule: no ratings in the markup, and an Offer only when the tour shows a real
// starting price (priceFrom); "price on request" tours carry none.
function tourMeta(t) {
  const desc = clipDesc((t.blurb && t.blurb.text) || t.summary || '');
  const url = ORIGIN + tourUrl(t.slug);
  const image = abs((t.images && t.images[0]) || FALLBACK_IMG);   // a tour without photos still gets a link preview
  const faqs = tourFaqs(t);
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'TouristTrip',
      name: t.name, description: t.summary || desc, url,
      image: image || undefined, touristType: t.cats,
      itinerary: {
        '@type': 'ItemList', numberOfItems: (t.itinerary || []).length,
        itemListElement: (t.itinerary || []).map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.title }))
      },
      provider: { '@type': 'TravelAgency', '@id': ORIGIN + '/#organization', name: 'Azat Tours', url: ORIGIN + '/' },
      // a starting price ("from"): minPrice in the specification says it is not a fixed price
      offers: t.priceFrom > 0 ? {
        '@type': 'Offer', price: t.priceFrom, priceCurrency: 'USD', url, availability: 'https://schema.org/InStock',
        priceSpecification: { '@type': 'UnitPriceSpecification', minPrice: t.priceFrom, priceCurrency: 'USD', unitText: 'per person', description: 'Starting price' + (t.priceNote ? ', ' + t.priceNote : ' per person') + '; the exact price depends on group size and season' }
      } : undefined
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'Tours', item: ORIGIN + '/tours/' },
        { '@type': 'ListItem', position: 3, name: t.name, item: url }
      ]
    }
  ];
  if (faqs.length) jsonld.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }))
  });
  // seoTitle: what search results show (query first, e.g. "Kyrgyzstan Road Trip 8 Days: ..."),
  // set from seo-audit/tour-titles.csv; the name stays the H1, the card title and what the bot shows.
  return { title: tourTitle(t.seoTitle || t.name), desc, url, image, ogType: 'website', jsonld };
}

// Normalize a place name to a SIGHTS key (fold umlauts, drop "lake"/qualifiers).
const normSight = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/·.*/, '').replace(/\blake\b/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  // the lakes are spelled several ways (Song-Kol/-Kul, Ysyk-/Issyk-Kol/-Kul): one key each
  .replace(/^(song|ala|issyk|ysyk)-k[ou]l$/, (m, lake) => ({ song: 'song-kol', ala: 'ala-kol' }[lake] || 'issyk-kol'));

// "What to pack" and "Before you go": a short list (3 to 5 points) chosen by the kind of trip,
// plus a link to the full guide, instead of the same nine points on all 79 pages.
// Sentences come from the earlier generic lists on every tour page, trimmed.
const PACK = {
  winter: [
    "Thermal base layers, top and bottom, to stay warm in deep cold",
    "An insulated hat and warm, waterproof gloves",
    "Heavy socks and warm, waterproof boots for snow",
    "Sunglasses and sunscreen: snow doubles the high-altitude glare",
    "A power bank, since the cold drains phone batteries fast"
  ],
  horseback: [
    "Long trousers that won't chafe during long hours in the saddle",
    "Closed shoes or boots with a small heel that sit well in the stirrups",
    "Riding gloves to protect your hands on the reins",
    "A waterproof, windproof jacket and a warm layer for cold yurt evenings",
    "Sun protection: a hat or cap, sunglasses, and high-SPF sunscreen"
  ],
  trekking: [
    "Proper hiking boots with ankle support for rocky, uneven trails",
    "Trekking poles to ease the climbs and descents",
    "A comfortable daypack with a refillable water bottle and snacks",
    "A waterproof, windproof jacket and warm layers for the passes",
    "Sun protection: a hat or cap, sunglasses, and high-SPF sunscreen"
  ],
  "road-trip": [
    "Motion-sickness tablets, as mountain roads can be winding and bumpy",
    "A light blanket or extra layer for long drives at altitude",
    "Comfortable shoes with grip for the short walks at each stop",
    "Sun protection: a hat or cap, sunglasses, and high-SPF sunscreen",
    "Some cash in Kyrgyz som for villages, where cards are not accepted"
  ],
  day: [
    "Comfortable shoes with good grip for uneven ground",
    "A refillable water bottle",
    "Sun protection: a hat or cap, sunglasses, and high-SPF sunscreen",
    "A light jacket: the mountains are cooler than Bishkek even in summer",
    "Some cash in Kyrgyz som for small purchases where cards are not accepted"
  ],
  combined: [
    "Warm layers you can add or shed, since mornings and evenings get cold even in summer",
    "A waterproof, windproof jacket for sudden mountain weather",
    "Sturdy, broken-in footwear with good grip for walking on uneven ground",
    "Sun protection: a hat or cap, sunglasses, and high-SPF sunscreen",
    "A power bank, as power is limited or absent at remote camps"
  ]
};
const BEFORE = {
  visa: "Visa: most Western and East-Asian passports enter visa-free for up to 30 days within any 60-day period (the rule changed at the end of 2025), so check your own nationality on evisa.e-gov.kg",
  money: "Money: the local currency is the Kyrgyz som; carry cash for villages and camps, as card payments mostly work only in towns",
  signal: "Connectivity: mobile data is decent in towns, but there is usually no signal at high mountain yurt camps, so let people know you may be offline",
  altitude: "Altitude: camps sit around 2,500 to 3,900 metres, so take it easy on the first day and drink plenty of water",
  water: "Drinking water: stick to bottled or boiled water, and bring enough for stretches where none is available",
  dayAltitude: "The gorges above Bishkek are higher and cooler than the city, so bring a layer and drink plenty of water",
  winterRoads: "Winter weather can change the day's plan; your guide adjusts the route for snow and road conditions",
  plugs: "Electricity: 230V with European-style round (Type C/F) plugs, so bring an adapter if you need one"
};
// Full guides on the blog: the packing/arrival guide (owner: a dedicated packing guide replaces it later),
// plus the articles that match the kind of trip.
const GUIDE_PACKING = { slug: 'easy-from-abroad', title: 'Easy from abroad: visas, arrival and logistics' };
const GUIDES = [
  { slug: 'ala-kol-trek-guide', title: 'The complete guide to the Ala-Kul trek', when: (t, text) => /ala[-\s]?k[ou]l/i.test(text) },
  { slug: 'yurt-culture-etiquette', title: 'Staying in a yurt: nomad culture & etiquette', when: (t, text) => /yurt/i.test(text) },
  { slug: 'best-time-to-visit-kyrgyzstan', title: 'When is the best time to visit Kyrgyzstan?', when: (t, text, kind) => kind === 'winter' || /season/i.test(t.season || '') },
  { slug: 'safety-in-the-mountains', title: 'Safety first: how we look after you in the mountains', when: (t, text, kind) => kind === 'trekking' || kind === 'horseback' },
];
// Which list a tour gets: winter first, then by the main activity tag, day trips, otherwise the combined list.
function tripKind(t) {
  const tags = t.tags || [], cats = t.cats || [];
  if (tags.includes('winter') || cats.includes('Winter tours')) return 'winter';
  if (cats.includes('Day trips') || (t.days || 0) <= 1) return 'day';
  if (tags.includes('horseback') || cats.includes('Horse riding')) return 'horseback';
  if (tags.includes('trekking')) return 'trekking';
  if (tags.includes('road-trip') || cats.includes('Road trip')) return 'road-trip';
  return 'combined';
}
function beforeList(t, kind) {
  const overnightHigh = (t.itinerary || []).some(d => /\b(2[5-9]|3\d)\d\d\s*m\b/.test(d.overnight || ''));
  if (kind === 'day') return [BEFORE.visa, BEFORE.money, BEFORE.dayAltitude, BEFORE.water];
  const out = [BEFORE.visa, BEFORE.money, BEFORE.signal];
  if (kind === 'winter') out.push(BEFORE.winterRoads);
  else if (overnightHigh || kind === 'horseback' || kind === 'trekking' || kind === 'combined') out.push(BEFORE.altitude);
  out.push(BEFORE.water);
  return out.slice(0, 5);
}
// Articles worth reading before this tour (at most three, the packing guide always included).
function tourGuides(t, POSTS) {
  const live = new Set((POSTS || []).map(p => p.slug));
  const text = [t.name, t.summary, ...(t.highlights || []), ...(t.itinerary || []).flatMap(d => [d.title, d.overnight])].filter(Boolean).join(' ');
  const kind = tripKind(t);
  const picks = GUIDES.filter(g => g.when(t, text, kind)).slice(0, 2);
  return [GUIDE_PACKING, ...picks].filter(g => !POSTS || live.has(g.slug)).map(g => ({ url: '/blog/' + g.slug + '/', title: g.title }));
}

const carIcon = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 16 1.2-6.5A2 2 0 0 1 8.2 8h7.6a2 2 0 0 1 2 1.5L19 16M4 16h16v3H4Z"/><circle cx="7.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/></svg>';
const tentIcon = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18Z"/><path d="M12 4v16"/></svg>';
const starIco = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.7 5.3L19 11l-5.3 1.7L12 18l-1.7-5.3L5 11l5.3-1.7Z"/></svg>';
const waIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4Z"/></svg>';

const waLink = t => `https://wa.me/996502888001?text=${encodeURIComponent("Hi Azat Tours! I'm interested in the " + t.name + " tour.")}`;

// Length variants of the same route: same `series` (or the same name without the "- N Days" suffix).
const seriesBase = x => x.series || x.name.replace(/\s*-\s*\d+\s*Days?\s*$/i, '').trim();
const seriesDays = n => { const m = n.match(/-\s*(\d+)\s*Days?\s*$/i); return m ? +m[1] : 0; };

// "Other tours you might like": the three most similar published trips. The old rule took the
// first three tours of the same category, so 21 tours received every link and 58 none.
// Score: shared places (3 each), shared category (2 each), shared tags (1 each), minus the
// difference in length (0.4 per day). Skipped: a tour whose canonical points to another page
// (its links would be wasted) and the length variants already listed under "Also available as".
const placeKey = p => String(p && p.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/·.*/, '').replace(/\blake\b/g, '').replace(/k[ou]l\b/g, 'kul').replace(/[^a-z0-9]+/g, '');
function relatedTours(t, TOURS, n = 3) {
  const places = new Set((t.places || []).map(placeKey).filter(k => k && k !== 'bishkek'));
  const isVariant = x => seriesDays(t.name) && seriesDays(x.name) && seriesBase(x) === seriesBase(t);
  return (TOURS || [])
    .filter(x => x.slug !== t.slug && !(x.canonical && x.canonical !== x.slug) && !isVariant(x))
    .map((x, i) => {
      const shared = (x.places || []).map(placeKey).filter(k => places.has(k)).length;
      const cats = (x.cats || []).filter(c => (t.cats || []).includes(c)).length;
      const tags = (x.tags || []).filter(g => (t.tags || []).includes(g)).length;
      return { x, i, score: shared * 3 + cats * 2 + tags - Math.abs((x.days || 0) - (t.days || 0)) * 0.4 };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, n).map(r => r.x);
}

// Full <main> content. TOURS = published tours (related + length variants), SIGHTS = gazetteer,
// POSTS = published posts (which guides can be linked).
function tourBody(t, TOURS, SIGHTS, POSTS, REVIEWS) {
  TOURS = TOURS || []; SIGHTS = SIGHTS || {};
  const faqs = tourFaqs(t);
  const wa = waLink(t);
  const img = i => asset((t.images && t.images[i]) || FALLBACK_IMG);

  const facts = [
    ['Duration', t.duration],
    ['Pace', t.tour_speed],
    ['Best season', t.season],
    ['Starts in', t.start_from],
    ['Total drive', t.total_drive && t.total_drive !== '0 km' ? t.total_drive : null]
  ].filter(f => f[1]);

  const highlights = (t.highlights && t.highlights.length ? t.highlights : []).slice(0, 4);

  const itineraryHTML = (t.itinerary || []).map((d, i) => {
    const transfer = d.transfer || d.drive || '';
    const descHTML = Array.isArray(d.desc) ? d.desc.filter(Boolean).map(p => `<p>${p}</p>`).join('') : (d.desc ? `<p>${d.desc}</p>` : '');
    const rows = [];
    if (transfer) rows.push(['Transfer', transfer]);
    if (d.activity) { const p = d.activity.split(' · '); rows.push([p[0], p.slice(1).join(' · ') || p[0]]); }
    if (d.meals) rows.push(['Meals', d.meals]);
    if (d.overnight) rows.push(['Overnight', d.overnight]);
    if (d.wc) rows.push(['WC', d.wc]);
    if (d.internet) rows.push(['Internet', d.internet]);
    const infoHTML = rows.map(([k, v]) => `<div class="ti"><b>${k}</b><span>${v}</span></div>`).join('');
    const metaBits = [transfer && carIcon + ' ' + transfer, d.overnight && tentIcon + ' ' + d.overnight].filter(Boolean).join(' · ');
    return `
    <div class="tl ${i === 0 ? 'open' : ''}" data-day="${d.day}">
      <button class="tl-q" type="button">
        <div><h3>${d.title}</h3>
          <div class="meta">${metaBits}</div>
        </div><span class="tgl">+</span>
      </button>
      <div class="tl-a">
        <div class="tl-body ${descHTML ? '' : 'no-desc'}">
          ${descHTML ? `<div class="tl-desc">${descHTML}</div>` : ''}
          ${infoHTML ? `<div class="tl-info">${infoHTML}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  const galleryImgs = (t.images || []).slice(1, 9).map(asset);
  const galleryHTML = galleryImgs.length ? `
    <section class="reveal in">
      <h2>Gallery</h2>
      <div class="gallery">
        ${galleryImgs.map((src, i) => { const wide = i === 0 || i === 3; return `<a href="${src}" target="_blank" rel="noopener" class="${i === 0 ? 'w2 h2' : (i === 3 ? 'w2' : '')}"><img loading="lazy" src="${src}"${srcset(src, wide ? '(max-width:680px) 100vw, 590px' : '(max-width:680px) 50vw, 290px')} alt="${t.name} tour in Kyrgyzstan, photo ${i + 1}"></a>`; }).join('')}
      </div>
    </section>` : '';

  // About this tour: ONE block of markup for both layouts (styles.css ".tour-tabs"). Phones show
  // it as tabs; desktop hides the tab bar and shows the panels stacked, each with its heading.
  // Every piece of content appears once: the summary stays in the hero, the pace/season/start
  // facts in the factbar, so "Good to know" lists only what is not shown above it.
  const kind = tripKind(t);
  const goodToKnow = [
    ['Accommodation', t.accommodations],
    ['Activities', t.activities],
    ['Departures from', t.start_from],
    ['Best time to go', t.season]
  ].filter(f => f[1]);
  const guides = tourGuides(t, POSTS);
  const panel = (id, title, open, body) => `
          <div class="tabpanel${open ? ' open' : ''}" data-panel="${id}" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}">
            <h2>${title}</h2>${body}
          </div>`;
  const tabsHTML = `
        <section class="reveal in tour-tabs">
          <div class="tabbar" role="tablist">
            <button class="tab active" data-tab="desc" role="tab" id="tab-desc" aria-selected="true" aria-controls="panel-desc">Description</button>
            <button class="tab" data-tab="info" role="tab" id="tab-info" aria-selected="false" aria-controls="panel-info">Additional info</button>
            <button class="tab" data-tab="pack" role="tab" id="tab-pack" aria-selected="false" aria-controls="panel-pack">What to pack</button>
            <button class="tab" data-tab="before" role="tab" id="tab-before" aria-selected="false" aria-controls="panel-before">Before you go</button>
          </div>${panel('desc', "Why you'll love this tour", true,
            highlights.length ? `<div class="hl-grid">${highlights.map(h => `<div class="hl"><span class="ic">${starIco}</span><div><b>${h}</b></div></div>`).join('')}</div>` : (t.summary ? `<p>${t.summary}</p>` : ''))}${panel('info', 'Good to know', false, `
            <div class="incl-grid">
              <ul class="yes facts">${goodToKnow.map(f => `<li><span><b>${f[0]}:</b> ${f[1]}</span></li>`).join('')}</ul>
              <ul class="yes">
                <li>Local certified English-speaking guide</li>
                <li>Private transport &amp; airport transfers</li>
                <li>Small group or fully private</li>
                <li>24/7 support team in Bishkek</li>
              </ul>
            </div>`)}${panel('pack', 'What to pack', false, `
            <ul class="book-perks">${PACK[kind].map(i => `<li>${i}</li>`).join('')}</ul>
            <p class="guide-links">Full packing list and arrival tips: <a href="/blog/${GUIDE_PACKING.slug}/">${GUIDE_PACKING.title}</a></p>`)}${panel('before', 'Before you go', false, `
            <ul class="tour-notes">${beforeList(t, kind).map(i => `<li>${i}</li>`).join('')}</ul>
            ${guides.length ? `<p class="guide-links">Read before you go: ${guides.map(g => `<a href="${g.url}">${g.title}</a>`).join(' · ')}</p>` : ''}`)}
        </section>`;

  // Sights carousel, dedupe places by normalized key; fall back to a tour photo when a place has no curated image.
  const seenSight = new Set();
  const sightSrc = ((t.places && t.places.length) ? t.places : (t.route || []).filter(p => p.name))
    .filter(p => { const k = normSight(p.name); if (!k || seenSight.has(k)) return false; seenSight.add(k); return true; });
  const sightsHTML = sightSrc.length ? `
        <section class="reveal in tour-sights">
          <h2>Sights visited on this tour</h2>
          <div class="exp-grid">${sightSrc.map(p => {
            const s = SIGHTS[normSight(p.name)] || {};
            const name = s.name || p.name;
            const src = s.photo ? asset(s.photo) : img(0);
            return `<div class="exp-card sight"><img loading="lazy" src="${src}"${srcset(src, '(max-width:680px) 74vw, 230px')} alt="${name}, Kyrgyzstan"><div><h3>${name}</h3>${s.blurb ? `<span>${s.blurb}</span>` : ''}</div></div>`;
          }).join('')}</div>
        </section>` : '';

  // related tours: the most similar trips (shared places, type, length), see relatedTours()
  const related = relatedTours(t, TOURS);
  const relCard = rt => {
    const rimg = asset(rt.images && rt.images[0] ? rt.images[0] : FALLBACK_IMG);
    const rhl = (rt.highlights && rt.highlights.length ? rt.highlights : rt.itinerary.map(d => d.title)).slice(0, 3).map(h => `<li>${h}</li>`).join('');
    return `<a class="tour" href="${tourUrl(rt.slug)}">
      <div class="tour-img"><img loading="lazy" src="${rimg}"${srcset(rimg, '(max-width:680px) 150px, 260px')} alt="${rt.name}"><span class="tour-badge">${rt.cats[0] || rt.category}</span>${rt.duration ? `<span class="tour-dur">${rt.duration}</span>` : ''}</div>
      <div class="tour-body"><h3>${rt.name}</h3><ul>${rhl}</ul>
        <div class="tour-foot">${tourFootLeft(rt)}<span class="tour-cta">View details </span></div>
      </div></a>`;
  };
  const relatedHTML = related.length ? `
        <section class="reveal in related-tours" style="border-bottom:0">
          <h2>Other tours you might like</h2>
          <div class="tours-grid">${related.map(relCard).join('')}</div>
        </section>` : '';

  // Length variants of the same route (the same loop runs as separate tours of
  // different lengths). Linking them turns near-clones that compete for the same
  // query into one cluster, and lets people pick by time budget. Grouped by the
  // `series` field; the day count comes from the NAME suffix.
  const variants = seriesDays(t.name)
    ? TOURS.filter(x => x.slug !== t.slug && seriesDays(x.name) && seriesBase(x) === seriesBase(t))
        .sort((a, b) => seriesDays(a.name) - seriesDays(b.name))
    : [];
  const variantHTML = variants.length ? `
        <div class="variant-row reveal in">Also available as: ${variants.map(v =>
          `<a href="${tourUrl(v.slug)}">${seriesDays(v.name)} days</a>`).join(' · ')}</div>` : '';

  // Visible FAQ accordion (own .tfaq-q class, toggled in tour-detail.js).
  const faqHTML = faqs.length ? `
        <section class="reveal in">
          <h2>Common questions</h2>
          <div>${faqs.map(f => `
            <div class="faq-item">
              <button class="tfaq-q">${f[0]}<span class="ic">+</span></button>
              <div class="faq-a"><p>${f[1]}</p></div>
            </div>`).join('')}
          </div>
        </section>` : '';

  return `
  <section class="tour-hero">
    <div class="bg"><img src="${img(0)}"${srcset(img(0), '100vw', [800, 1280, 1600])} fetchpriority="high" alt="${t.name}, guided tour in Kyrgyzstan" /></div>
    <div class="wrap">
      <p class="crumb reveal in"><a href="/">Home</a> / <a href="/tours/">Tours</a> / ${t.name}</p>
      <div class="badges reveal in">${(t.cats || []).map(c => `<span class="pill">${c}</span>`).join('')}<span class="pill sale">Free quote · no prepayment</span></div>
      <h1 class="reveal in">${t.name}</h1>
      <p class="sub reveal in">${t.summary || ''}</p>
      <div class="factbar reveal in">${facts.map(f => `<div class="f"><b>${f[1]}</b><span>${f[0]}</span></div>`).join('')}</div>
    </div>
  </section>

  <section class="pad">
    <div class="wrap">
      <div class="tour-main">

        ${tabsHTML}
        ${variantHTML}

        <section class="reveal in">
          <h2>Day-by-day itinerary</h2>
          <p>Tap any day to expand. Every itinerary can be tailored to your dates, pace and fitness.</p>
          <div class="timeline">${itineraryHTML}</div>
        </section>

        ${sightsHTML}

        ${galleryHTML}
${Reviews.tourSection(REVIEWS, t.slug)}
        ${faqHTML}

        <section id="book" class="reveal in" style="${relatedHTML ? '' : 'border-bottom:0'}">
          <h2>Tell us about your trip</h2>
          <p>Tell us your dates and we'll confirm availability and a tailored price within 24 hours. Free to enquire, no prepayment.</p>
          <div class="book-grid">
          <div class="form-card" style="box-shadow:var(--shadow);padding:30px">
            <form id="leadForm">
              <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <input type="hidden" name="tour" value="${esc(t.name).replace(/"/g, '&quot;')}" />
              <div class="field"><label for="name">Full name</label><input id="name" name="name" type="text" placeholder="Jane Traveller" required /></div>
              <div class="field-row">
                <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" placeholder="you@email.com" required /></div>
                <div class="field"><label for="people">Travellers</label><select id="people" name="people"><option>1</option><option>2</option><option>3-4</option><option>5-8</option><option>9+</option></select></div>
              </div>
              <div class="field"><label for="dates">Preferred dates</label><input id="dates" name="dates" type="text" placeholder="e.g. mid-July 2026" /></div>
              <div class="field"><label for="msg">Anything else?</label><textarea id="msg" name="msg" placeholder="Fitness level, add-ons, questions…"></textarea></div>
              <button type="submit" class="btn btn-primary">Send enquiry</button>
              <a href="${wa}" target="_blank" rel="noopener" class="form-wa">${waIcon} WhatsApp</a>
              <p class="form-note"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> We reply within 24h. No prepayment, no spam.</p>
            </form>
            <div class="form-success" id="formSuccess">
              <div class="big"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/></svg></div><h3>Enquiry received!</h3>
              <p style="color:var(--ink-soft)">A local expert will email you within 24 hours about “${t.name}”.</p>
            </div>
          </div>
          <aside class="book-side">
            ${t.priceFrom > 0
              ? `<div class="book-price"><span>Price</span><b>from $${t.priceFrom}</b><em>${t.priceNote ? esc(t.priceNote) + '. We confirm the exact price for your group.' : 'per person. The exact price depends on group size and season; we confirm it for your group.'}</em></div>`
              : '<div class="book-price"><span>Price</span><b>On request</b><em>Tailored to group size, season &amp; options</em></div>'}
            <div class="bk-h">Why book direct with us</div>
            <ul class="book-perks">
              <li>Talk to a real local, not a call centre</li>
              <li>Free to enquire · no prepayment</li>
              <li>Tailored to your dates, pace &amp; budget</li>
              <li>A reply within 24 hours</li>
            </ul>
            <div class="book-contact">
              <a href="${wa}" target="_blank" rel="noopener" class="wa">${waIcon} WhatsApp</a>
            </div>
          </aside>
          </div>
        </section>
        ${relatedHTML}
      </div>
    </div>
  </section>`;
}

module.exports = { ORIGIN, abs, clipDesc, tourTitle, tourFaqs, tourMeta, tourBody, waLink, tripKind, tourGuides, PACK, beforeList, relatedTours };
