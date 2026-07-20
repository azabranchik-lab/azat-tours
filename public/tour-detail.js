// Renders a single tour detail page from window.TOURS based on ?slug= or ?id=.
(function () {
  const TOURS = window.TOURS || [];
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const id = params.get('id');
  // With a slug/id: match exactly (unknown -> not found). Bare tour.html: show the first tour.
  const t = (slug || id)
    ? TOURS.find(x => (slug && x.slug === slug) || (id && String(x.id) === id)) || null
    : TOURS[0];
  const root = document.getElementById('tourRoot');
  if (!t) { root.innerHTML = '<div class="wrap" style="padding:160px 0 80px"><h1>Tour not found</h1><p><a href="tours.html">← Back to all tours</a></p></div>'; return; }

  document.title = `${t.name}, Kyrgyzstan Tour | Azat Tours`;

  // ---- per-tour SEO: meta description, og tags, canonical, JSON-LD ----
  // Honesty rule: no Offer (price is on request) and no ratings in the markup.
  (function seo() {
    const desc = ((t.blurb && t.blurb.text) || t.summary || '').slice(0, 158);
    const pageUrl = 'https://azattours.com/tour.html?slug=' + encodeURIComponent(t.slug);
    const setMeta = (attr, key, val) => {
      if (!val) return;
      let m = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.appendChild(m); }
      m.setAttribute('content', val);
    };
    setMeta('name', 'description', desc);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:title', document.title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:image', (t.images && t.images[0]) || '');
    setMeta('name', 'twitter:card', 'summary_large_image');
    let canon = document.head.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
    canon.href = pageUrl;
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org', '@type': 'TouristTrip',
        name: t.name, description: t.summary || desc,
        image: (t.images && t.images[0]) || undefined,
        touristType: t.cats,
        itinerary: { '@type': 'ItemList', numberOfItems: (t.itinerary || []).length, itemListElement: (t.itinerary || []).map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.title })) },
        provider: { '@type': 'TravelAgency', name: 'Azat Tours Kyrgyzstan', url: 'https://azattours.com' }
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://azattours.com/' },
          { '@type': 'ListItem', position: 2, name: 'Tours', item: 'https://azattours.com/tours.html' },
          { '@type': 'ListItem', position: 3, name: t.name, item: pageUrl }
        ]
      }
    ]);
    document.head.appendChild(ld);
  })();
  const wa = `https://wa.me/996222222011?text=${encodeURIComponent("Hi Azat Tours! I'm interested in the " + t.name + " tour.")}`;
  const img = i => (t.images && t.images[i]) || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80';

  // Sights gazetteer (photo + blurb per place), owner-managed via the bot (/sights),
  // loaded from sights-data.js (window.SIGHTS). Fallback to {} so the page still renders.
  const SIGHTS = window.SIGHTS || {};
  // Normalize a place name to a SIGHTS key (fold umlauts, drop "lake"/qualifiers).
  const normSight = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7.*/, '').replace(/\blake\b/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // Generic tab content (paraphrased from research). Source: scripts/_tabs.json.
  const PACK_BASE = [
    "Warm layers you can add or shed, such as a fleece or light down jacket, since mornings and evenings get cold even in summer",
    "Lighter clothes for the middle of the day, like t-shirts and a long-sleeve shirt",
    "A waterproof, windproof jacket for sudden mountain weather",
    "Sturdy, broken-in footwear with good grip for walking on uneven ground",
    "Sun protection: a hat or cap, sunglasses, and high-SPF sunscreen for strong high-altitude sun",
    "A refillable water bottle so you can top up at camps and guesthouses",
    "A power bank and your charging cables, as power is limited or absent at remote camps",
    "A small personal first-aid kit with any medications you take regularly",
    "Some cash in Kyrgyz som for small purchases where cards are not accepted"
  ];
  const PACK_BY_TAG = {
    trekking: ["Proper hiking boots with ankle support for rocky, uneven trails", "Trekking poles to ease the climbs and descents", "A comfortable daypack for water, snacks, and a spare layer"],
    horseback: ["Long trousers that won't chafe during long hours in the saddle", "Riding gloves to protect your hands on the reins", "Closed shoes or boots with a small heel that sit well in the stirrups"],
    "road-trip": ["Motion-sickness tablets, as mountain roads can be winding and bumpy", "A light blanket or extra layer for long drives at altitude", "Snacks and entertainment for the stretches between stops"],
    winter: ["Thermal base layers, top and bottom, to stay warm in deep cold", "An insulated hat and warm, waterproof gloves", "Heavy socks and warm, waterproof boots for snow"]
  };
  const BEFORE = [
    "Visa: most Western and East-Asian passports enter visa-free for up to 30 days within any 60-day period, a rule that changed at the end of 2025, so check your own nationality on evisa.e-gov.kg before you travel",
    "Money: the local currency is the Kyrgyz som; carry cash for villages and camps, as card payments mostly work only in towns and cities",
    "ATMs and exchange: withdraw or change money in larger towns; rates at banks and exchange offices beat the airport",
    "Connectivity: mobile data is decent in towns, but there is usually no signal at high mountain yurt camps, so let people know you may be offline",
    "Altitude: some camps sit around 3,000 to 3,900 metres, so take it easy on the first day and drink plenty of water",
    "Drinking water: stick to bottled or boiled water, and bring enough for stretches where none is available",
    "Electricity: the supply is 230V with European-style round (Type C/F) plugs, so bring an adapter if you need one",
    "Tipping: tips are not required but always appreciated for guides, drivers, and camp staff who look after you",
    "Language: Kyrgyz and Russian are the main languages; a few basic phrases go a long way, and your guide can translate"
  ];

  const facts = [
    ['Duration', t.duration],
    ['Pace', t.tour_speed],
    ['Best season', t.season],
    ['Starts in', t.start_from],
    ['Total drive', t.total_drive && t.total_drive !== '0 km' ? t.total_drive : null]
  ].filter(f => f[1]);

  const highlights = (t.highlights && t.highlights.length ? t.highlights : []).slice(0, 4);

  const carIcon = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 16 1.2-6.5A2 2 0 0 1 8.2 8h7.6a2 2 0 0 1 2 1.5L19 16M4 16h16v3H4Z"/><circle cx="7.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/></svg>';
  const tentIcon = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18Z"/><path d="M12 4v16"/></svg>';

  const itineraryHTML = t.itinerary.map((d, i) => {
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

  const galleryImgs = (t.images || []).slice(1, 9);
  const galleryHTML = galleryImgs.length ? `
    <section class="reveal in">
      <h2>Gallery</h2>
      <div class="gallery">
        ${galleryImgs.map((src, i) => `<a href="${src}" target="_blank" rel="noopener" class="${i === 0 ? 'w2 h2' : (i === 3 ? 'w2' : '')}"><img loading="lazy" src="${src}" alt="${t.name} photo ${i + 1}"></a>`).join('')}
      </div>
    </section>` : '';

  // Additional-info facts (existing fields) for the About tab.
  const addInfo = [
    ['Pace', t.tour_speed],
    ['Best season', t.season],
    ['Starts in', t.start_from],
    ['Total drive', t.total_drive && t.total_drive !== '0 km' ? t.total_drive : null],
    ['Accommodation', t.accommodations],
    ['Activities', t.activities]
  ].filter(f => f[1]);
  const ttags = t.tags || [];
  const packList = [...new Set([...PACK_BASE, ...ttags.flatMap(tag => PACK_BY_TAG[tag] || [])])];
  const starIco = '<svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.7 5.3L19 11l-5.3 1.7L12 18l-1.7-5.3L5 11l5.3-1.7Z"/></svg>';

  const tabsHTML = `
        <section class="reveal in tour-tabs about-mobile">
          <div class="tabbar" role="tablist">
            <button class="tab active" data-tab="desc">Description</button>
            <button class="tab" data-tab="info">Additional info</button>
            <button class="tab" data-tab="pack">What to pack</button>
            <button class="tab" data-tab="before">Before you go</button>
          </div>
          <div class="tabpanel open" data-panel="desc">
            ${t.summary ? `<p class="lead-in">${t.summary}</p>` : ''}
            ${highlights.length ? `<div class="hl-grid">${highlights.map(h => `<div class="hl"><span class="ic">${starIco}</span><div><b>${h}</b></div></div>`).join('')}</div>` : ''}
          </div>
          <div class="tabpanel" data-panel="info">
            <div class="tl-info info-box">${addInfo.map(([k, v]) => `<div class="ti"><b>${k}</b><span>${v}</span></div>`).join('')}</div>
            <ul class="book-perks tab-incl">
              <li>Local certified English-speaking guide</li>
              <li>Private transport &amp; airport transfers</li>
              <li>Small group or fully private</li>
              <li>24/7 support team in Bishkek</li>
            </ul>
          </div>
          <div class="tabpanel" data-panel="pack">
            <ul class="book-perks">${packList.map(i => `<li>${i}</li>`).join('')}</ul>
          </div>
          <div class="tabpanel" data-panel="before">
            <ul class="tour-notes">${BEFORE.map(i => `<li>${i}</li>`).join('')}</ul>
          </div>
        </section>`;

  // Desktop keeps the prior expanded layout (no tabs): "Why you'll love" + "Good to know".
  // Toggled against .about-mobile (tabs) via @media, mobile hides these, desktop hides the tabs.
  const goodToKnow = [
    ['Accommodation', t.accommodations],
    ['Activities', t.activities],
    ['Departures from', t.start_from],
    ['Best time to go', t.season]
  ].filter(f => f[1]);
  const desktopAboutHTML = `
        ${highlights.length ? `<section class="reveal in about-desktop">
          <h2>Why you'll love this tour</h2>
          <div class="hl-grid">${highlights.map(h => `<div class="hl"><span class="ic">${starIco}</span><div><b>${h}</b></div></div>`).join('')}</div>
        </section>` : ''}
        <section class="reveal in about-desktop">
          <h2>Good to know</h2>
          <div class="incl-grid">
            <ul class="yes facts">${goodToKnow.map(f => `<li><span><b>${f[0]}:</b> ${f[1]}</span></li>`).join('')}</ul>
            <ul class="yes">
              <li>Local certified English-speaking guide</li>
              <li>Private transport &amp; airport transfers</li>
              <li>Small group or fully private</li>
              <li>24/7 support team in Bishkek</li>
            </ul>
          </div>
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
            return `<div class="exp-card sight"><img loading="lazy" src="${s.photo || img(0)}" alt="${name}"><div><h3>${name}</h3>${s.blurb ? `<span>${s.blurb}</span>` : ''}</div></div>`;
          }).join('')}</div>
        </section>` : '';


  // related tours (same category preferred, else any)
  const RARROW = '';
  const relPool = TOURS.filter(x => x.slug !== t.slug);
  const relSame = relPool.filter(x => (x.cats || []).some(c => (t.cats || []).includes(c)));
  const related = (relSame.length >= 3 ? relSame : relPool).slice(0, 3);
  const relCard = rt => {
    const rimg = rt.images && rt.images[0] ? rt.images[0] : 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80';
    const rhl = (rt.highlights && rt.highlights.length ? rt.highlights : rt.itinerary.map(d => d.title)).slice(0, 3).map(h => `<li>${h}</li>`).join('');
    return `<a class="tour" href="tour.html?slug=${encodeURIComponent(rt.slug)}">
      <div class="tour-img"><img loading="lazy" src="${rimg}" alt="${rt.name}"><span class="tour-badge">${rt.cats[0] || rt.category}</span>${rt.duration ? `<span class="tour-dur">${rt.duration}</span>` : ''}</div>
      <div class="tour-body"><h3>${rt.name}</h3><ul>${rhl}</ul>
        <div class="tour-foot"><span class="tour-tag">${rt.tour_speed || 'Small group'}</span><span class="tour-cta">View details ${RARROW}</span></div>
      </div></a>`;
  };
  const relatedHTML = related.length ? `
        <section class="reveal in related-tours" style="border-bottom:0">
          <h2>Other tours you might like</h2>
          <div class="tours-grid">${related.map(relCard).join('')}</div>
        </section>` : '';

  root.innerHTML = `
  <section class="tour-hero">
    <div class="bg"><img src="${img(0)}" alt="${t.name}" /></div>
    <div class="wrap">
      <p class="crumb reveal in"><a href="index.html">Home</a> / <a href="tours.html">Tours</a> / ${t.name}</p>
      <div class="badges reveal in">${t.cats.map(c => `<span class="pill">${c}</span>`).join('')}<span class="pill sale">Free quote · no prepayment</span></div>
      <h1 class="reveal in">${t.name}</h1>
      <p class="sub reveal in">${t.summary || ''}</p>
      <div class="factbar reveal in">${facts.map(f => `<div class="f"><b>${f[1]}</b><span>${f[0]}</span></div>`).join('')}</div>
    </div>
  </section>

  <section class="pad">
    <div class="wrap">
      <div class="tour-main">

        ${tabsHTML}
        ${desktopAboutHTML}

        <section class="reveal in">
          <h2>Day-by-day itinerary</h2>
          <p>Tap any day to expand. Every itinerary can be tailored to your dates, pace and fitness.</p>
          <div class="timeline">${itineraryHTML}</div>
        </section>

        ${sightsHTML}

        ${galleryHTML}

        <section id="book" class="reveal in" style="${relatedHTML ? '' : 'border-bottom:0'}">
          <h2>Tell us about your trip</h2>
          <p>Tell us your dates and we'll confirm availability and a tailored price within 24 hours. Free to enquire, no prepayment.</p>
          <div class="book-grid">
          <div class="form-card" style="box-shadow:var(--shadow);padding:30px">
            <form id="leadForm">
              <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <input type="hidden" name="tour" value="${t.name}" />
              <div class="field"><label for="name">Full name</label><input id="name" name="name" type="text" placeholder="Jane Traveller" required /></div>
              <div class="field-row">
                <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" placeholder="you@email.com" required /></div>
                <div class="field"><label for="people">Travellers</label><select id="people" name="people"><option>1</option><option>2</option><option>3-4</option><option>5-8</option><option>9+</option></select></div>
              </div>
              <div class="field"><label for="dates">Preferred dates</label><input id="dates" name="dates" type="text" placeholder="e.g. mid-July 2026" /></div>
              <div class="field"><label for="msg">Anything else?</label><textarea id="msg" name="msg" placeholder="Fitness level, add-ons, questions…"></textarea></div>
              <button type="submit" class="btn btn-primary">Send enquiry</button>
              <a href="${wa}" target="_blank" rel="noopener" class="form-wa"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4Z"/></svg> WhatsApp</a>
              <p class="form-note"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> We reply within 24h. No prepayment, no spam.</p>
            </form>
            <div class="form-success" id="formSuccess">
              <div class="big"><svg class="gico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m2 20 6.5-12L13 17l3-5 6 8Z"/><path d="m8.5 8 2.2 4"/></svg></div><h3>Enquiry received!</h3>
              <p style="color:var(--ink-soft)">A local expert will email you within 24 hours about “${t.name}”.</p>
            </div>
          </div>
          <aside class="book-side">
            <div class="book-price"><span>Price</span><b>On request</b><em>Tailored to group size, season &amp; options</em></div>
            <div class="bk-h">Why book direct with us</div>
            <ul class="book-perks">
              <li>Talk to a real local, not a call centre</li>
              <li>Free to enquire · no prepayment</li>
              <li>Tailored to your dates, pace &amp; budget</li>
              <li>A reply within 24 hours</li>
            </ul>
            <div class="book-contact">
              <a href="${wa}" target="_blank" rel="noopener" class="wa"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4Z"/></svg> WhatsApp</a>
            </div>
          </aside>
          </div>
        </section>
        ${relatedHTML}
      </div>
    </div>
  </section>`;

  // update floating WA + mobile bar with tour-specific message
  document.querySelectorAll('[data-wa]').forEach(a => a.href = wa);

  // itinerary accordion
  root.querySelectorAll('.tl-q').forEach(q => {
    q.onclick = () => {
      const item = q.parentElement, a = item.querySelector('.tl-a'), open = item.classList.contains('open');
      item.classList.toggle('open');
      a.style.maxHeight = open ? null : a.scrollHeight + 'px';
    };
  });
  const first = root.querySelector('.tl.open .tl-a');
  if (first) first.style.maxHeight = first.scrollHeight + 'px';

  // about-this-tour tabs
  root.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      const id = tab.dataset.tab;
      root.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === tab));
      root.querySelectorAll('.tabpanel').forEach(p => p.classList.toggle('open', p.dataset.panel === id));
    };
  });

})();
