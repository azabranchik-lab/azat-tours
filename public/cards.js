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
          <img loading="lazy" src="${img}" alt="${t.name}" />
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
      <div class="img"><img src="${asset(p.cover)}" alt="${esc(p.title)}"></div>
      <div class="body">
        <div class="post-meta"><span class="tag">${esc(p.category)}</span><span>${dateStr(p.date)}</span></div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.excerpt)}</p>
        <span class="btn btn-dark" style="align-self:flex-start">Read the guide</span>
      </div></a>`;
  }

  function postCard(p) {
    return `<a href="${postUrl(p.slug)}" class="post reveal in" data-cat="${esc(p.category)}">
      <div class="img"><img loading="lazy" src="${asset(p.cover)}" alt="${esc(p.title)}"></div>
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

  return { esc, asset, tourUrl, postUrl, dateStr, FALLBACK_IMG, tourCard, tourFootLeft, featuredTours, postFeatured, postCard, carUrl, thumbUrl, seatsText, carFrom, carCard };
});
