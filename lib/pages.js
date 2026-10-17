// Server-rendered pages: template (public/*.html) + content -> ready HTML.
// Search engines, AI crawlers and link scrapers get the full page (title,
// description, canonical, Open Graph, JSON-LD, navigation, H1, body text, lists)
// without running JS.
//
// Pages are rendered on request from content/*.json and cached in memory; the
// cache key includes the content and template mtimes, so a bot edit or a deploy
// shows up immediately and nothing has to be rebuilt by hand.
const fs = require('fs');
const path = require('path');
const content = require('./content');
const Cards = require('../public/cards');
const Nav = require('../public/nav');
const { ORIGIN, tourMeta, tourBody } = require('./tour-page');
const { postMeta, postBody } = require('./post-page');
const { carMeta, carBody } = require('./car-page');
const text = require('./text-pages');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
const day = ms => new Date(ms || Date.now()).toISOString().slice(0, 10);
// "<" is escaped so a content value can never close the script tag
const ldScript = json => `<script type="application/ld+json">${JSON.stringify(json).replace(/</g, '\\u003c')}</script>\n`;

// ---------- old slug -> current slug (301 source) ----------
// scripts/_tour-renames.json: { renames: { "<old>": { slug } | { hide, redirect } } }
const RENAMES_JSON = path.join(content.ROOT, 'scripts', '_tour-renames.json');
let _renames = { m: -1, map: {} };
function renames() {
  const m = mtime(RENAMES_JSON);
  if (m !== _renames.m) {
    let map = {};
    try { map = JSON.parse(fs.readFileSync(RENAMES_JSON, 'utf8')).renames || {}; } catch (e) { console.error('renames map unreadable:', e.message); }
    _renames = { m, map };
  }
  return _renames.map;
}
// Follow the rename chain to the slug that is live today (a tour may be renamed twice).
function resolveTourSlug(slug) {
  const map = renames();
  let s = slug;
  for (let i = 0; i < 6 && map[s]; i++) s = map[s].hide ? map[s].redirect : map[s].slug;
  return s || slug;
}

// ---------- content ----------
// content/*.json is the source of truth; if it is missing or unreadable (it is
// excluded from deploys) fall back to the public *-data.js the bot regenerates,
// and say so in the log instead of failing silently.
function readDataJs(file) {
  const src = fs.readFileSync(file, 'utf8');
  return JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
}
function loadList(jsonPath, dataJs) {
  try { return JSON.parse(fs.readFileSync(jsonPath, 'utf8')); }
  catch (e) {
    console.error('content unreadable, using ' + path.basename(dataJs) + ':', e.message);
    try { return readDataJs(dataJs); } catch (e2) { console.error(e2.message); return null; }
  }
}
// Cars have no public *-data.js fallback: a missing cars.json simply means no cars.
function loadCars() {
  try { return JSON.parse(fs.readFileSync(content.CARS_JSON, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('cars.json unreadable:', e.message); return []; }
}
const SOURCES = [content.TOURS_JSON, content.POSTS_JSON, content.SIGHTS_JSON, content.CARS_JSON, content.TOURS_DATA_JS, content.POSTS_DATA_JS, RENAMES_JSON];
const HTML_FILES = () => fs.readdirSync(content.PUBLIC).filter(f => f.endsWith('.html')).map(f => path.join(content.PUBLIC, f));
let _data = { v: '' };
// Which content/template files changed is checked at most once per CHECK_MS: the check lists
// public/ and stats ~20 files synchronously, and doing it on every call (several per request)
// capped the site at ~420 pages/s in the 2026-10-17 load test. A bot edit still shows within a second.
const CHECK_MS = 1000;
let _v = '', _vAt = 0;
function sourcesVersion() {
  const now = Date.now();
  if (now - _vAt >= CHECK_MS) { _v = SOURCES.concat(HTML_FILES()).map(mtime).join('|'); _vAt = now; }
  return _v;
}
function data() {
  const v = sourcesVersion();
  if (_data.v !== v) {
    const tours = loadList(content.TOURS_JSON, content.TOURS_DATA_JS) || [];
    const posts = loadList(content.POSTS_JSON, content.POSTS_DATA_JS) || [];
    const sights = loadList(content.SIGHTS_JSON, content.SIGHTS_DATA_JS) || {};
    const pubTours = content.publishedOnly(tours);
    const cars = loadCars();
    _data = {
      v, tours, posts, sights, pubTours, cars,
      // the car rental section exists on the site only while at least one car is published
      pubCars: content.publishedOnly(cars),
      pubPosts: content.publishedOnly(posts).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      toursDay: day(mtime(content.TOURS_JSON) || mtime(content.TOURS_DATA_JS)),
      html: new Map()
    };
  }
  return _data;
}
function cached(key, build) {
  const d = data();
  if (!d.html.has(key)) d.html.set(key, build(d));
  return d.html.get(key);
}

// ---------- templates ----------
// Header, mobile menu, footer and floating button (public/nav.js) go into the HTML
// itself, so every page links to the main sections without JavaScript.
function withChrome(html) {
  const m = html.match(/<body[^>]*\bdata-page="([^"]*)"[^>]*>/);
  const chrome = m && Nav.render(m[1], { cars: data().pubCars.length > 0 });
  if (!chrome || html.includes('<header id="header"')) return html;
  const out = html.replace(m[0], () => m[0] + '\n' + chrome.top);
  const at = out.indexOf('<script src="/nav.js">');
  return at < 0 ? out.replace('</body>', () => chrome.bottom + '\n</body>') : out.slice(0, at) + chrome.bottom + '\n' + out.slice(at);
}
const template = name => withChrome(fs.readFileSync(path.join(content.PUBLIC, name), 'utf8'));

// ---------- <head> ----------
function headTags(m, noindex) {
  return (noindex ? '<meta name="robots" content="noindex">\n' : '') +
    `<meta name="description" content="${attr(m.desc)}">\n` +
    `<link rel="canonical" href="${attr(m.canonical || m.url)}">\n` +
    (m.markdown ? `<link rel="alternate" type="text/markdown" href="${attr(m.markdown)}">\n` : '') +
    `<meta property="og:type" content="${m.ogType}">\n` +
    `<meta property="og:site_name" content="Azat Tours">\n` +
    `<meta property="og:title" content="${attr(m.title)}">\n` +
    `<meta property="og:description" content="${attr(m.desc)}">\n` +
    `<meta property="og:url" content="${attr(m.url)}">\n` +
    (m.image ? `<meta property="og:image" content="${attr(m.image)}">\n` : '') +
    `<meta name="twitter:card" content="summary_large_image">\n` +
    `<meta name="twitter:title" content="${attr(m.title)}">\n` +
    `<meta name="twitter:description" content="${attr(m.desc)}">\n` +
    (m.image ? `<meta name="twitter:image" content="${attr(m.image)}">\n` : '') +
    (m.jsonld ? ldScript(m.jsonld) : '');
}
// Item templates carry only a placeholder title/description; replace both.
function itemPage(tpl, mainId, m, body, noindex) {
  return template(tpl)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/i, '')
    .replace('</head>', () => headTags(m, noindex) + '</head>')
    .replace(`<main id="${mainId}"></main>`, () => `<main id="${mainId}">${body}</main>`);
}
const listLd = (name, url, items) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', name, url, numberOfItems: items.length,
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url }))
});

// ---------- pages ----------
// A tour that is a length variant of another may name it in `canonical` (a slug):
// both stay on the site, search engines are pointed at the main one.
const canonicalOf = (t, d) => (t.canonical && t.canonical !== t.slug && d.pubTours.some(x => x.slug === t.canonical)) ? t.canonical : null;

// opts.preview: also render drafts (secret-key gated by the caller), never indexed.
function tourPage(slug, opts) {
  const preview = !!(opts && opts.preview);
  const build = d => {
    const t = (preview ? d.tours.filter(x => x.status !== 'hidden') : d.pubTours).find(x => x.slug === slug);
    if (!t) return null;
    const m = tourMeta(t), main = canonicalOf(t, d);
    if (main) m.canonical = ORIGIN + Cards.tourUrl(main);
    m.markdown = '/tours/' + t.slug + '.md';
    return itemPage('tour.html', 'tourRoot', m, tourBody(t, d.pubTours, d.sights), preview);
  };
  return preview ? build(data()) : cached('tour:' + slug, build);
}
function postPage(slug, opts) {
  const preview = !!(opts && opts.preview);
  const build = d => {
    const p = (preview ? d.posts : d.pubPosts).find(x => x.slug === slug);
    if (!p) return null;
    const m = postMeta(p);
    m.markdown = '/blog/' + p.slug + '.md';
    return itemPage('post.html', 'postRoot', m, postBody(p, resolveTourSlug), preview);
  };
  return preview ? build(data()) : cached('post:' + slug, build);
}
// ---------- rental cars ----------
function carPage(slug, opts) {
  const preview = !!(opts && opts.preview);
  const build = d => {
    const c = (preview ? d.cars.filter(x => x.status !== 'hidden') : d.pubCars).find(x => x.slug === slug);
    if (!c) return null;
    const m = carMeta(c);
    m.markdown = '/cars/' + c.slug + '.md';
    return itemPage('car.html', 'carRoot', m, carBody(c, d.pubCars), preview);
  };
  return preview ? build(data()) : cached('car:' + slug, build);
}
function carsIndex() {
  return cached('cars', d => d.pubCars.length ? template('cars.html')
    .replace('</head>', () => ldScript(listLd('Car rental in Kyrgyzstan by Azat Tours', ORIGIN + '/cars/', d.pubCars.map(c => ({ name: c.name, url: ORIGIN + Cards.carUrl(c.slug) })))) + '</head>')
    .replace(/(<span id="carCount">)[^<]*(<\/span>)/, (m, a, b) => a + d.pubCars.length + (d.pubCars.length === 1 ? ' car' : ' cars') + b)
    .replace('<div class="tours-grid" id="carsGrid"></div>', () => `<div class="tours-grid" id="carsGrid">${d.pubCars.map(Cards.carCard).join('')}</div>`) : null);
}

function toursIndex() {
  return cached('tours', d => template('tours.html')
    .replace('</head>', () => ldScript(listLd('Kyrgyzstan tours by Azat Tours', ORIGIN + '/tours/', d.pubTours.map(t => ({ name: t.name, url: ORIGIN + Cards.tourUrl(t.slug) })))) + '</head>')
    .replace(/(<span id="tourCount">)[^<]*(<\/span>)/, (m, a, b) => a + d.pubTours.length + b)
    .replace('<div class="tours-grid" id="toursGrid"></div>', () => `<div class="tours-grid" id="toursGrid">${d.pubTours.map(Cards.tourCard).join('')}</div>`));
}
function blogIndex() {
  return cached('blog', d => {
    const [first, ...rest] = d.pubPosts;
    return template('blog.html')
      .replace('</head>', () => ldScript(listLd('Azat Tours travel blog', ORIGIN + '/blog/', d.pubPosts.map(p => ({ name: p.title, url: ORIGIN + Cards.postUrl(p.slug) })))) + '</head>')
      .replace('<div id="blogFeatured"></div>', () => `<div id="blogFeatured">${first ? Cards.postFeatured(first) : ''}</div>`)
      .replace('<div class="blog-grid" id="blogGrid"></div>', () => `<div class="blog-grid" id="blogGrid">${first ? rest.map(Cards.postCard).join('') : '<p>No articles yet.</p>'}</div>`);
  });
}
// Any other public/*.html (home, about, contact, plan, 404...): navigation in the
// HTML, and on the home page the featured tours too. Returns null for a non-page.
function staticPage(file) {
  if (!/^[a-z0-9-]+\.html$/.test(file) || !fs.existsSync(path.join(content.PUBLIC, file))) return null;
  return cached('static:' + file, d => {
    const html = template(file);
    return file !== 'index.html' ? html : html.replace('<div class="tours-grid" id="featuredGrid"></div>',
      () => `<div class="tours-grid" id="featuredGrid">${Cards.featuredTours(d.pubTours).map(Cards.tourCard).join('')}</div>`);
  });
}

// ---------- plain-text versions for AI assistants ----------
const llmsTxt = () => cached('llms', d => text.llmsTxt(d.pubTours, d.pubPosts, d.pubCars));
const llmsFullTxt = () => cached('llms-full', d => text.llmsFull(d.pubTours, d.pubPosts, resolveTourSlug));
const tourMarkdown = slug => cached('tour-md:' + slug, d => { const t = d.pubTours.find(x => x.slug === slug); return t ? text.tourMd(t) : null; });
const carMarkdown = slug => cached('car-md:' + slug, d => { const c = d.pubCars.find(x => x.slug === slug); return c ? text.carMd(c) : null; });
const postMarkdown = slug => cached('post-md:' + slug, d => { const p = d.pubPosts.find(x => x.slug === slug); return p ? text.postMd(p, resolveTourSlug) : null; });

// ---------- sitemap ----------
// static pages: [path, source file, changefreq, priority]. reviews.html stays out
// (noindex until real reviews exist); builder.html stays out (app-like).
const STATIC = [
  ['/', 'index.html', 'weekly', '1.0'],
  ['/tours/', 'tours.html', 'weekly', '0.9'],
  ['/plan-trip.html', 'plan-trip.html', 'monthly', '0.8'],
  ['/blog/', 'blog.html', 'weekly', '0.7'],
  ['/cars/', 'cars.html', 'weekly', '0.7'],      // only while a car is published (see sitemapXml)
  ['/about.html', 'about.html', 'monthly', '0.7'],
  ['/contact.html', 'contact.html', 'monthly', '0.6'],
];
const maxDay = list => list.reduce((a, b) => (b && b > a ? b : a), '');
function sitemapXml() {
  return cached('sitemap', d => {
    const url = (loc, lastmod, freq, pr) => `  <url>\n    <loc>${ORIGIN}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${pr}</priority>\n  </url>`;
    const tourDay = t => t.updatedAt || d.toursDay;
    const postDay = p => p.updated || p.updatedAt || p.date || d.toursDay;
    const fileDay = f => day(mtime(path.join(content.PUBLIC, f)));
    const carDay = c => c.updatedAt || d.toursDay;
    const entries = [
      ...STATIC.filter(([loc]) => loc !== '/cars/' || d.pubCars.length).map(([loc, file, freq, pr]) => {
        // list pages change whenever any of their items does
        const extra = loc === '/tours/' ? d.pubTours.map(tourDay) : loc === '/blog/' ? d.pubPosts.map(postDay) : loc === '/cars/' ? d.pubCars.map(carDay) : [];
        return url(loc, maxDay([fileDay(file), ...extra]), freq, pr);
      }),
      // a tour that points its canonical at another one is not listed
      ...d.pubTours.filter(t => !canonicalOf(t, d)).map(t => url(Cards.tourUrl(t.slug), tourDay(t), 'monthly', '0.8')),
      ...d.pubPosts.map(p => url(Cards.postUrl(p.slug), postDay(p), 'monthly', '0.6')),
      ...d.pubCars.map(c => url(Cards.carUrl(c.slug), carDay(c), 'weekly', '0.6')),
    ];
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries.join('\n') + '\n</urlset>\n';
  });
}

// Cheap identity of the current content+templates, for ETags.
// Includes the process start, so a code-only deploy never answers 304 for old HTML.
const BOOT = Date.now().toString(36);
const version = () => { let h = 0; const v = BOOT + data().v; for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const tourIdSlug = id => { const t = data().pubTours.find(x => String(x.id) === String(id)); return t ? t.slug : null; };
const hasTour = slug => data().pubTours.some(x => x.slug === slug);
const hasPost = slug => data().pubPosts.some(x => x.slug === slug);
const hasCar = slug => data().pubCars.some(x => x.slug === slug);
const hasCars = () => data().pubCars.length > 0;
const counts = () => { const d = data(); return { tours: d.pubTours.length, posts: d.pubPosts.length, cars: d.pubCars.length }; };

module.exports = {
  tourPage, postPage, toursIndex, blogIndex, staticPage, sitemapXml,
  carPage, carsIndex, carMarkdown, hasCar, hasCars,
  llmsTxt, llmsFullTxt, tourMarkdown, postMarkdown,
  resolveTourSlug, tourIdSlug, hasTour, hasPost, version, counts
};
