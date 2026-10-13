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
            <span class="tour-tag">${t.tour_speed || 'Small group'}</span>
            <span class="tour-cta">View details </span>
          </div>
        </div>
      </a>`;
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

  return { esc, asset, tourUrl, postUrl, dateStr, FALLBACK_IMG, tourCard, postFeatured, postCard };
});
