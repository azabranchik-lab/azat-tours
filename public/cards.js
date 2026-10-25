// Shared card markup for tours and blog posts. Loaded in the browser (window.Cards)
// AND required by the server (lib/pages.js), so the lists the server sends in the
// HTML are byte-identical to what the page scripts render. All URLs are
// root-absolute because the same markup lives on /, /tours/ and /tours/<slug>/.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // site-relative asset path ("img/x.jpg") -> root-absolute; external URLs untouched
  const asset = u => !u ? '' : (/^(https?:)?\/\//.test(u) || u.charAt(0) === '/' ? u : '/' + u);
  const tourUrl = slug => '/tours/' + encodeURIComponent(slug) + '/';
  const postUrl = slug => '/blog/' + encodeURIComponent(slug) + '/';
  const FALLBACK_IMG = 'img/hero/hero-1-reflection-1400.jpg';
  const dateStr = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  // srcset for a site image: server.js serves resized copies at ?w=480|800|1280|1600
  // (lib/imgvariants.js), so a phone no longer downloads a 1280 px photo for a 360 px card.
  // Only local photos qualify; anything else gets no srcset and keeps working as before.
  const RESIZABLE = /^\/(img|images)\/[^?#]+\.(jpe?g|png)$/i;
  function srcset(src, sizes, widths) {
    const u = asset(src);
    if (!RESIZABLE.test(u)) return '';
    return ` srcset="${(widths || [480, 800, 1280]).map(w => u + '?w=' + w + ' ' + w + 'w').join(', ')}" sizes="${sizes}"`;
  }
  // tour cards: one column on phones, two on tablets, three or four on desktop
  const CARD_SIZES = '(max-width:680px) 100vw, (max-width:980px) 50vw, 380px';

  function tourCard(t) {
    const img = asset(t.images && t.images[0] ? t.images[0] : FALLBACK_IMG);
    const hl = (t.highlights && t.highlights.length ? t.highlights : t.itinerary.map(d => d.title))
      .slice(0, 3).map(h => `<li>${h}</li>`).join('');
    const b = t.blurb;
    const body = (b && b.text)
      ? `${b.hook ? `<p class="tour-hook">${b.hook}</p>` : ''}<p class="tour-blurb">${b.text}</p>`
      : `<ul>${hl}</ul>`;   // fallback: tours without a blurb show highlight bullets
    // compact meta chips (shown on mobile cards only, hidden on desktop via CSS)
    const meta = '<div class="tour-meta">' +
      `<span class="tm tm-cat">${t.cats[0] || t.category}</span>` +
      (t.duration ? `<span class="tm">${t.duration}</span>` : '') +
      (t.tour_speed ? `<span class="tm">${t.tour_speed.replace(/[\s-]*paced$/i, '').replace(/^Moderately$/i, 'Moderate').trim()}</span>` : '') +
      '</div>';
    return `
      <a class="tour" href="${tourUrl(t.slug)}" data-cats="${t.cats.join('|')}" data-tags="${(t.tags || []).join('|')}" data-days="${t.days || 0}">
        <div class="tour-img">
          <img loading="lazy" src="${img}"${srcset(img, CARD_SIZES)} alt="${t.name}" />
          <span class="tour-badge">${t.cats[0] || t.category}</span>
          ${t.duration ? `<span class="tour-dur">${t.duration}</span>` : ''}
        </div>
        <div class="tour-body">
          <h3>${t.name}</h3>
          ${meta}
          ${body}
          <div class="tour-foot">
            ${tourFootLeft(t)}
            <span class="tour-cta">View details </span>
          </div>
        </div>
      </a>`;
  }
  // Card footer, left side: the starting price when the tour has one (priceFrom, USD
  // per person), otherwise the pace as before.
  function tourFootLeft(t) {
    return t.priceFrom > 0
      ? `<span class="tour-tag tour-price"><b>from $${t.priceFrom}</b> / person</span>`
      : `<span class="tour-tag">${t.tour_speed || 'Small group'}</span>`;
  }

  // Home page pick: a varied six (long combined trips, a horse trip, a short one).
  // A slug that no longer exists is skipped and the longest tours fill the gap.
  const FEATURED = ['kyrgyzstan-grand-tour-10-days', 'song-kul-horse-trek-ala-kul-hike-7-days', 'two-lakes-kok-bulak-horse-trek-7-days', 'kok-kiya-kel-suu-road-trip-8-days', 'song-kul-horse-trek-3-days', 'issyk-kul-altyn-arashan-4-days'];
  function featuredTours(tours) {
    const pick = [];
    const byDays = [...tours].sort((a, b) => b.days - a.days);
    FEATURED.forEach(s => { const t = tours.find(x => x.slug === s); if (t) pick.push(t); });
    while (pick.length < 6 && byDays.length) { const t = byDays.shift(); if (!pick.includes(t)) pick.push(t); }
    return pick.slice(0, 6);
  }

  function postFeatured(p) {
    return `<a href="${postUrl(p.slug)}" class="blog-feature reveal in" style="cursor:pointer">
      <div class="img"><img src="${asset(p.cover)}"${srcset(p.cover, '(max-width:680px) 100vw, 50vw')} alt="${esc(p.title)}"></div>
      <div class="body">
        <div class="post-meta"><span class="tag">${esc(p.category)}</span><span>${dateStr(p.date)}</span></div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.excerpt)}</p>
        <span class="btn btn-dark" style="align-self:flex-start">Read the guide</span>
      </div></a>`;
  }

  function postCard(p) {
    return `<a href="${postUrl(p.slug)}" class="post reveal in" data-cat="${esc(p.category)}">
      <div class="img"><img loading="lazy" src="${asset(p.cover)}"${srcset(p.cover, '(max-width:680px) 116px, (max-width:980px) 50vw, 380px')} alt="${esc(p.title)}"></div>
      <div class="body"><div class="post-meta"><span class="tag">${esc(p.category)}</span></div>
      <h3>${esc(p.title)}</h3><span class="more">Read more</span></div></a>`;
  }

  // ---------- rental cars (content/cars.json, added through the admin bot) ----------
  const carUrl = slug => '/cars/' + encodeURIComponent(slug) + '/';
  // Bot uploads (images/...) have a 480 px preview next to them: foo.jpg -> foo-t.jpg
  const thumbUrl = u => (/^\/?images\//.test(u || '') ? asset(u).replace(/(\.[a-z0-9]+)$/i, '-t$1') : asset(u));
  const seatsText = n => (n >= 8 ? '8+' : String(n));
  // lowest daily price on offer (0 = not offered)
  const carFrom = c => Math.min(...[c.priceSelf, c.priceDriver].filter(p => p > 0));
  function carCard(c) {
    const img = (c.images && c.images[0]) ? thumbUrl(c.images[0]) : asset(FALLBACK_IMG);
    const chips = [
      c.type && `<span class="tm tm-cat">${esc(c.type)}</span>`,
      c.transmission && `<span class="tm">${esc(c.transmission)}</span>`,
      c.seats && `<span class="tm">${seatsText(c.seats)} seats</span>`,
      c.fuel && `<span class="tm">${esc(c.fuel)}</span>`
    ].filter(Boolean).join('');
    const from = carFrom(c);
    return `
      <a class="tour car-card" href="${carUrl(c.slug)}">
        <div class="tour-img">
          <img loading="lazy" src="${img}" alt="${esc(c.name)} for rent in Kyrgyzstan" />
          ${c.drive ? `<span class="tour-badge">${esc(c.drive)}</span>` : ''}
          ${c.available === false ? '<span class="tour-dur">Booked now</span>' : ''}
        </div>
        <div class="tour-body">
          <h3>${esc(c.name)}</h3>
          ${chips ? `<div class="tour-meta">${chips}</div>` : ''}
          <div class="tour-foot">
            <span class="tour-tag">${isFinite(from) ? `<b>from $${from}</b> / day` : 'Price on request'}</span>
            <span class="tour-cta">View details </span>
          </div>
        </div>
      </a>`;
  }

  // ---------- catalog filter toolbar (/tours/) ----------
  // One source of markup for the server (lib/pages.js puts it in the HTML, so the list
  // does not jump when the page loads) and for tours-render.js (behaviour, and the
  // bottom sheet). items = [{ cats: [...], tags: [...] }] for every card in the grid.
  const CAT_ORDER = ['Day trips', 'Combined', 'Horse riding', 'Road trip', 'Off-the-beaten-path', 'Winter tours'];   // 'Day trips' added 2026-10-16 (owner) for the one-day tours
  const TAG_ORDER = [
    ['trekking', 'Trekking'], ['horseback', 'Horseback'], ['road-trip', 'Road trip'], ['off-road', 'Off-road'],
    ['short', 'Up to 4 days'], ['week', '1 week'], ['long', '9+ days'],
    ['summer', 'Summer'], ['winter', 'Winter'], ['all-year', 'All year'],
  ];
  const TAG_GROUPS = [['Activity', ['trekking', 'horseback', 'road-trip', 'off-road']], ['Duration', ['short', 'week', 'long']], ['Season', ['summer', 'winter', 'all-year']]];
  // shared "filters" icon (mobile button and the desktop All-filters button)
  const FILTER_ICON = '<svg class="dfb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="8" x2="20" y2="8"/><circle cx="10" cy="8" r="2.4" fill="var(--surface)"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.4" fill="var(--surface)"/></svg>';
  function filterCounts(items) {
    const TOTAL = items.length;
    const catCount = cat => items.filter(i => (i.cats || []).includes(cat)).length;
    const tagCount = tag => items.filter(i => (i.tags || []).includes(tag)).length;
    const present = CAT_ORDER.filter(c => catCount(c) > 0);
    const tagLabel = k => (TAG_ORDER.find(x => x[0] === k) || [k, k])[1];
    const groups = TAG_GROUPS.map(([g, keys]) => [g, keys.filter(k => tagCount(k) > 0)]).filter(([, ks]) => ks.length);
    return { TOTAL, catCount, tagCount, present, tagLabel, groups };
  }
  const tagChips = (f, ks) => ks.map(k => `<button class="chip chip-tag" type="button" data-t="${k}">${f.tagLabel(k)} <span class="chip-n">${f.tagCount(k)}</span></button>`).join('');
  function catalogToolbar(items) {
    const f = filterCounts(items);
    // category chips (desktop row + mobile swipe row)
    const bar = `<button class="chip active" data-f="all">All <span style="opacity:.6">${f.TOTAL}</span></button>` +
      f.present.map(c => `<button class="chip" data-f="${c}">${c} <span style="opacity:.6">${f.catCount(c)}</span></button>`).join('');
    // desktop toolbar: Filters button (left, opens a popover) + category pills
    const catBtns = `<button class="chip active" data-f="all">All <span class="chip-n">${f.TOTAL}</span></button>` +
      f.present.map(c => `<button class="chip" data-f="${c}">${c} <span class="chip-n">${f.catCount(c)}</span></button>`).join('');
    const popGroups = f.groups.map(([g, ks]) => `<div class="dpop-group"><div class="dpop-gtitle">${g}</div><div class="dpop-chips">${tagChips(f, ks)}</div></div>`).join('');
    const dfilters = '<div class="dfilters">' +
      '<div class="dfilters-act">' +
        `<button class="dfilter-btn" id="dFilterBtn" type="button">${FILTER_ICON}<span>All filters</span><span class="dfilter-badge" hidden>0</span></button>` +
        '<div class="dpop" id="dFilterPop">' +
          '<div class="dpop-head"><b>All filters</b><button class="dpop-clear" type="button" data-clear>Clear all</button></div>' +
          `<div class="dpop-body">${popGroups}</div>` +
        '</div>' +
      '</div>' +
      `<div class="dcats" id="dCatBar">${catBtns}</div>` +
    '</div>';
    // mobile toolbar: live count, sort segment, one big "All filters" button (opens the sheet)
    const mtoolbar = '<div class="mtoolbar">' +
      `<span class="mcount">${f.TOTAL} tours</span>` +
      '<div class="msort-seg" id="mSortSeg">' + [['rec', 'Recommended'], ['short', 'Shortest'], ['long', 'Longest']]
        .map(([k, l]) => `<button type="button" data-fsort="${k}"${k === 'rec' ? ' class="sel"' : ''}>${l}</button>`).join('') + '</div>' +
      `<button id="mFilterBtn" class="mfilter-btn" type="button">${FILTER_ICON}<span>All filters</span><span class="mfilter-badge" hidden>${f.TOTAL}</span></button>` +
    '</div>';
    return { bar, dfilters, mtoolbar };
  }
  // mobile bottom sheet: Type (categories, single-select) + tag filters, grouped. Added by tours-render.js.
  function filterSheet(items) {
    const f = filterCounts(items);
    const sheetCats = `<button class="chip chip-tag" type="button" data-f="all">All <span class="chip-n">${f.TOTAL}</span></button>` +
      f.present.map(c => `<button class="chip chip-tag" type="button" data-f="${c}">${c} <span class="chip-n">${f.catCount(c)}</span></button>`).join('');
    return '<div class="fs-backdrop" data-close></div>' +
      '<div class="fs-panel">' +
        '<div class="fs-head"><b>All filters</b><button class="fs-x" type="button" data-close aria-label="Close">&times;</button></div>' +
        '<div class="fs-body">' +
        `<div class="fs-group"><div class="fs-gtitle">Type</div><div class="fs-chips">${sheetCats}</div></div>` +
        f.groups.map(([g, ks]) => `<div class="fs-group"><div class="fs-gtitle">${g}</div><div class="fs-chips">${tagChips(f, ks)}</div></div>`).join('') +
        '</div>' +
        '<div class="fs-foot"><button class="fs-clear" type="button" data-clear>Clear</button><button class="fs-show btn btn-primary" type="button" data-close>Show tours</button></div>' +
      '</div>';
  }

  return { esc, asset, tourUrl, postUrl, dateStr, FALLBACK_IMG, srcset, CARD_SIZES, tourCard, tourFootLeft, featuredTours, postFeatured, postCard, carUrl, thumbUrl, seatsText, carFrom, carCard, CAT_ORDER, TAG_ORDER, catalogToolbar, filterSheet };
});
