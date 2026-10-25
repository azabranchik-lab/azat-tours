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
const { execFileSync } = require('child_process');
const content = require('./content');
const Cards = require('../public/cards');
const Nav = require('../public/nav');
const { ORIGIN, tourMeta, tourBody } = require('./tour-page');
const { postMeta, postBody } = require('./post-page');
const { carMeta, carBody } = require('./car-page');
const text = require('./text-pages');
const { imageSize } = require('./imgsize');
const Reviews = require('./reviews');
const contact = require('./contact');

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
const SOURCES = [content.TOURS_JSON, content.POSTS_JSON, content.SIGHTS_JSON, content.CARS_JSON, content.REVIEWS_JSON, content.SITE_JSON, content.TOURS_DATA_JS, content.POSTS_DATA_JS, RENAMES_JSON];
// templates, plus the stylesheet and scripts: their mtimes also version the asset URLs (see finalize)
const HTML_FILES = () => fs.readdirSync(content.PUBLIC).filter(f => /\.(html|css|js)$/.test(f)).map(f => path.join(content.PUBLIC, f));
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
    const reviews = content.publishedOnly(loadList(content.REVIEWS_JSON, content.REVIEWS_DATA_JS) || []);
    const site = content.loadSite();
    _data = {
      v, tours, posts, sights, pubTours, cars, reviews, site,
      profiles: site.profiles || {},   // links to the public review profiles (badges)
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
// Same, for an HTML page: the page passes through finalize() once, then stays cached.
const page = (key, build) => cached(key, d => finalize(build(d)));

// ---------- last pass over every HTML page ----------
// 1. The first screen (hero) is shown at once: its .reveal elements get the "in" class in the
//    markup instead of waiting for window.load, so the headline paints with the first frame.
// 2. /styles.css and /*.js get ?v=<file mtime>, and server.js caches such URLs for a year:
//    a repeat visit downloads nothing it already has, a deploy changes the version.
// 3. Every local <img> gets width/height from the file, so the box is reserved before the
//    picture arrives (the global CSS keeps height:auto, so nothing is stretched).
const assetVersions = new Map();   // "/styles.css" -> "k3f2a"
function assetVersion(file) {
  const m = mtime(path.join(content.PUBLIC, file));
  return m ? Math.round(m / 1000).toString(36) : '';
}
function finalize(html) {
  if (html == null) return html;
  html = html.split('{{CONTACT_EMAIL}}').join(contact.email);   // lib/contact.js: one place for the address
  html = html.replace(/<section class="(?:hero|page-hero)[^"]*"[^>]*>[\s\S]*?<\/section>/, hero =>
    hero.replace(/class="([^"]*)"/g, (m, cls) => (/\breveal\b/.test(cls) && !/\bin\b/.test(cls)) ? `class="${cls} in"` : m));
  html = html.replace(/(href|src)="\/([a-z0-9-]+\.(?:css|js))"/g, (m, attr, file) => {
    const v = assetVersion(file);
    return v ? `${attr}="/${file}?v=${v}"` : m;
  });
  html = html.replace(/<img\b[^>]*>/g, tag => {
    if (/\swidth=|\sheight=/.test(tag)) return tag;
    const m = tag.match(/\ssrc="\/?((?:img|images)\/[^"?#]+)/);
    if (!m) return tag;
    const size = imageSize(path.join(content.PUBLIC, m[1]));
    if (!size) return tag;
    return tag.replace(/\s*\/?>$/, end => ` width="${size.width}" height="${size.height}"${end}`);
  });
  return html;
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
// m.alternates = [{ hreflang, href }] (en, ko, x-default) once a page has a translation;
// m.lang sets <html lang>. Both are empty today: hreflang is emitted only for real translations.
function headTags(m, noindex) {
  return (noindex ? '<meta name="robots" content="noindex">\n' : '') +
    `<meta name="description" content="${attr(m.desc)}">\n` +
    `<link rel="canonical" href="${attr(m.canonical || m.url)}">\n` +
    (m.alternates || []).map(a => `<link rel="alternate" hreflang="${attr(a.hreflang)}" href="${attr(a.href)}">\n`).join('') +
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
    .replace(/<html lang="[a-zA-Z-]+"/, () => `<html lang="${attr(m.lang || 'en')}"`)
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
    return itemPage('tour.html', 'tourRoot', m, tourBody(t, d.pubTours, d.sights, d.pubPosts, d.reviews), preview);
  };
  return preview ? finalize(build(data())) : page('tour:' + slug, build);
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
  return preview ? finalize(build(data())) : page('post:' + slug, build);
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
  return preview ? finalize(build(data())) : page('car:' + slug, build);
}
function carsIndex() {
  return page('cars', d => d.pubCars.length ? template('cars.html')
    .replace('</head>', () => ldScript(listLd('Car rental in Kyrgyzstan by Azat Tours', ORIGIN + '/cars/', d.pubCars.map(c => ({ name: c.name, url: ORIGIN + Cards.carUrl(c.slug) })))) + '</head>')
    .replace(/(<span id="carCount">)[^<]*(<\/span>)/, (m, a, b) => a + d.pubCars.length + (d.pubCars.length === 1 ? ' car' : ' cars') + b)
    .replace('<div class="tours-grid" id="carsGrid"></div>', () => `<div class="tours-grid" id="carsGrid">${d.pubCars.map(Cards.carCard).join('')}</div>`) : null);
}

function toursIndex() {
  return page('tours', d => {
    // the filter toolbar goes into the HTML (same markup tours-render.js would build), so the list does not jump on load
    const tb = Cards.catalogToolbar(d.pubTours.map(t => ({ cats: t.cats || [], tags: t.tags || [] })));
    return template('tours.html')
      .replace('</head>', () => ldScript(listLd('Kyrgyzstan tours by Azat Tours', ORIGIN + '/tours/', d.pubTours.map(t => ({ name: t.name, url: ORIGIN + Cards.tourUrl(t.slug) })))) + '</head>')
      .replace(/(<span id="tourCount">)[^<]*(<\/span>)/, (m, a, b) => a + d.pubTours.length + b)
      .replace('<div class="filters" id="filterBar"></div>', () => `${tb.dfilters}<div class="filters" id="filterBar">${tb.bar}</div>`)
      .replace('<div class="tours-grid" id="toursGrid"></div>', () => `${tb.mtoolbar}<div class="tours-grid" id="toursGrid">${d.pubTours.map(Cards.tourCard).join('')}</div>`);
  });
}
function blogIndex() {
  return page('blog', d => {
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
  return page('static:' + file, d => {
    const html = template(file);
    // home: featured tours and the guest reviews (section dropped while there are none)
    if (file === 'index.html') return Reviews.homePage(html.replace('<div class="tours-grid" id="featuredGrid"></div>',
      () => `<div class="tours-grid" id="featuredGrid">${Cards.featuredTours(d.pubTours).map(Cards.tourCard).join('')}</div>`), d.reviews, d.profiles);
    // reviews page: every review, profile badges, "review us" buttons; noindex until there is a review
    if (file === 'reviews.html') return Reviews.reviewsPage(html, d.reviews, d.profiles, r => { const t = d.pubTours.find(x => x.slug === (r.tourSlug || String(r.placement || '').replace(/^tour:/, ''))); return t ? t.name : ''; });
    return html;
  });
}

// ---------- plain-text versions for AI assistants ----------
const llmsTxt = () => cached('llms', d => text.llmsTxt(d.pubTours, d.pubPosts, d.pubCars));
const llmsFullTxt = () => cached('llms-full', d => text.llmsFull(d.pubTours, d.pubPosts, resolveTourSlug));
const tourMarkdown = slug => cached('tour-md:' + slug, d => { const t = d.pubTours.find(x => x.slug === slug); return t ? text.tourMd(t) : null; });
const carMarkdown = slug => cached('car-md:' + slug, d => { const c = d.pubCars.find(x => x.slug === slug); return c ? text.carMd(c) : null; });
const postMarkdown = slug => cached('post-md:' + slug, d => { const p = d.pubPosts.find(x => x.slug === slug); return p ? text.postMd(p, resolveTourSlug) : null; });

// ---------- sitemap ----------
// static pages: [path, source file]. reviews.html stays out (noindex until real reviews
// exist); builder.html stays out (app-like, noindex). Only <loc> and <lastmod>: Google
// ignores changefreq and priority. The lastmod of a static page is the last git commit of
// its template (a deploy resets file mtimes), with the mtime as fallback.
const STATIC = [
  ['/', 'index.html'],
  ['/tours/', 'tours.html'],
  ['/plan-trip.html', 'plan-trip.html'],
  ['/blog/', 'blog.html'],
  ['/cars/', 'cars.html'],      // only while a car is published (see sitemapXml)
  ['/about.html', 'about.html'],
  ['/contact.html', 'contact.html'],
  ['/reviews.html', 'reviews.html'],   // only once there is at least one review (see sitemapXml)
];
const maxDay = list => list.reduce((a, b) => (b && b > a ? b : a), '');
const _gitDay = new Map();
function gitDay(file) {
  if (!_gitDay.has(file)) {
    let d = '';
    try { d = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'public/' + file], { cwd: content.ROOT, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString().trim(); } catch (e) { /* no git on this machine */ }
    _gitDay.set(file, /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
  }
  return _gitDay.get(file) || day(mtime(path.join(content.PUBLIC, file)));
}
function sitemapXml() {
  return cached('sitemap', d => {
    const url = (loc, lastmod) => `  <url>\n    <loc>${ORIGIN}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    const tourDay = t => t.updatedAt || d.toursDay;
    const postDay = p => p.updated || p.updatedAt || p.date || d.toursDay;
    const carDay = c => c.updatedAt || d.toursDay;
    const entries = [
      ...STATIC.filter(([loc]) => (loc !== '/cars/' || d.pubCars.length) && (loc !== '/reviews.html' || Reviews.all(d.reviews).length)).map(([loc, file]) => {
        // list pages change whenever any of their items does
        const extra = loc === '/tours/' ? d.pubTours.map(tourDay) : loc === '/blog/' ? d.pubPosts.map(postDay) : loc === '/cars/' ? d.pubCars.map(carDay) : [];
        return url(loc, maxDay([gitDay(file), ...extra]));
      }),
      // a tour that points its canonical at another one is not listed
      ...d.pubTours.filter(t => !canonicalOf(t, d)).map(t => url(Cards.tourUrl(t.slug), tourDay(t))),
      ...d.pubPosts.map(p => url(Cards.postUrl(p.slug), postDay(p))),
      ...d.pubCars.map(c => url(Cards.carUrl(c.slug), carDay(c))),
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
  finalize,
  tourPage, postPage, toursIndex, blogIndex, staticPage, sitemapXml,
  carPage, carsIndex, carMarkdown, hasCar, hasCars,
  llmsTxt, llmsFullTxt, tourMarkdown, postMarkdown,
  resolveTourSlug, tourIdSlug, hasTour, hasPost, version, counts
};
