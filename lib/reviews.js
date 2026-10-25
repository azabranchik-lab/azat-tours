// Guest reviews in the HTML (home carousel, tour page, reviews page) and the badges that link
// to the public review profiles. Data: content/reviews.json (added through the admin bot or
// scripts/import-reviews.js), profiles: content/site.json "profiles".
//
// Honesty rules: a block appears only when there is at least one real review; no scores,
// counts or ratings are shown unless they come from the data; no stock avatars.
const { esc, asset } = require('../public/cards');

const SOURCES = {
  tripadvisor: { name: 'Tripadvisor', cls: 'ta', color: '#00AA6C' },
  google: { name: 'Google', cls: 'go', color: '#4285F4' },
  getyourguide: { name: 'GetYourGuide', cls: 'gyg', color: '#FF5533' },
  direct: { name: 'sent to us directly', cls: '', color: '' },
};
const sourceName = s => (SOURCES[s] || {}).name || '';
const stars = n => '★★★★★'.slice(0, Math.max(1, Math.min(5, Number(n) || 5)));
// "July 2026" from 2026-07-14 / 2026-07 / free text
function dateText(d) {
  const m = /^(\d{4})-(\d{2})/.exec(String(d || ''));
  if (!m) return String(d || '').trim();
  return new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
}
// only a photo of the guest that lives on this site; never a stock placeholder
const localAvatar = r => (r.avatar && /^\/?(images|img)\//.test(r.avatar)) ? asset(r.avatar) : '';

// One card, same markup the old client script produced (public/reviews-render.js), plus the
// date and the source line, with a link to the original when there is one.
function card(r, tourName) {
  const src = sourceName(r.source);
  const where = src ? (r.sourceUrl ? `<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener nofollow">${r.source === 'direct' ? src : 'on ' + src}</a>` : (r.source === 'direct' ? src : 'on ' + src)) : '';
  const sub = [r.country, dateText(r.date), where, tourName ? `about ${esc(tourName)}` : ''].filter(Boolean).join(' · ');
  const img = localAvatar(r);
  return `<div class="review"><div class="stars" aria-label="${stars(r.rating).length} out of 5">${stars(r.rating)}</div><p>"${esc(r.text)}"</p>
      <div class="who">${img ? `<img loading="lazy" src="${img}" alt="${esc(r.name)}">` : ''}<div><b>${esc(r.name)}</b>${sub ? `<span>${sub}</span>` : ''}</div></div></div>`;
}

const isLive = r => r && r.text && r.name;
const forHome = reviews => (reviews || []).filter(r => isLive(r) && r.placement === 'home');
const forTour = (reviews, slug) => (reviews || []).filter(r => isLive(r) && (r.tourSlug === slug || r.placement === 'tour:' + slug));
const all = reviews => (reviews || []).filter(isLive);

// Links to the public profiles (content/site.json: { profiles: { tripadvisor, google, getyourguide } }).
// Shown without scores or counts: those are not in our data.
function badges(profiles) {
  const items = ['tripadvisor', 'google', 'getyourguide'].filter(k => profiles && /^https?:\/\//.test(profiles[k] || ''));
  if (!items.length) return '';
  return `<div class="badges-strip">${items.map(k => `<a href="${esc(profiles[k])}" target="_blank" rel="noopener" class="rev-badge ${SOURCES[k].cls}"><div class="src"><svg class="gicf" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="${SOURCES[k].color}"/></svg> ${SOURCES[k].name}</div><div class="count">Read our reviews</div></a>`).join('')}</div>`;
}
// "Review us on ..." buttons for the reviews page
function reviewButtons(profiles) {
  const items = ['tripadvisor', 'google', 'getyourguide'].filter(k => profiles && /^https?:\/\//.test(profiles[k] || ''));
  return items.map((k, i) => `<a href="${esc(profiles[k])}" target="_blank" rel="noopener" class="btn ${i ? 'btn-dark' : 'btn-primary'}">Review us on ${SOURCES[k].name}</a>`).join('\n        ');
}

// Home page: fill the "What guests say" carousel or drop the whole section.
function homePage(html, reviews, profiles) {
  const list = forHome(reviews);
  if (!list.length) return html.replace(/\n?<!-- =+ REVIEWS =+ -->\n?/, '\n').replace(/<section class="pad" id="reviews">[\s\S]*?<\/section>\n?/, '');
  return html.replace('<div class="rev-track" id="revTrack"></div>', () => `<div class="rev-track" id="revTrack">${list.map(r => card(r)).join('')}</div>${badges(profiles)}`);
}
// Tour page section (lib/tour-page.js puts it before the FAQ); '' without reviews.
function tourSection(reviews, slug) {
  const list = forTour(reviews, slug);
  if (!list.length) return '';
  return `
        <section class="reveal in tour-reviews">
          <h2>What guests say about this tour</h2>
          <div class="rev-track">${list.map(r => card(r)).join('')}</div>
        </section>`;
}
// Reviews page: every review, the profile badges, the "review us" buttons. Stays noindex
// while there is nothing to show.
function reviewsPage(html, reviews, profiles, tourNameOf) {
  const list = all(reviews);
  const b = badges(profiles), btns = reviewButtons(profiles);
  html = html.replace('<div class="badges-strip" id="revBadges"></div>', () => b);
  html = html.replace('<div class="reviews-masonry" id="reviewsMasonry"></div>', () => `<div class="reviews-masonry" id="reviewsMasonry">${list.map(r => card(r, tourNameOf && tourNameOf(r))).join('')}</div>`);
  html = html.replace('<div class="btns" id="reviewButtons"></div>', () => btns ? `<div class="btns">${btns}</div>` : '');
  if (!btns) html = html.replace(/<section class="pad" id="leave-review">[\s\S]*?<\/section>\n?/, '');
  if (list.length) html = html.replace(/<meta name="robots" content="noindex"\s*\/?>\n?/, '');
  return html;
}

module.exports = { card, badges, reviewButtons, forHome, forTour, all, homePage, tourSection, reviewsPage, dateText, SOURCES };
