// Server-rendered pages: template (public/*.html) + content -> ready HTML.
// Search engines and link scrapers get the full page (title, description,
// canonical, Open Graph, JSON-LD, H1, body text, lists) without running JS.
//
// Pages are rendered on request from content/*.json and cached in memory; the
// cache key includes the content and template mtimes, so a bot edit or a deploy
// shows up immediately and nothing has to be rebuilt by hand.
const fs = require('fs');
const path = require('path');
const content = require('./content');
const Cards = require('../public/cards');
const { ORIGIN, tourMeta, tourBody } = require('./tour-page');
const { postMeta, postBody } = require('./post-page');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
const day = ms => new Date(ms || Date.now()).toISOString().slice(0, 10);

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
const SOURCES = [content.TOURS_JSON, content.POSTS_JSON, content.SIGHTS_JSON, content.TOURS_DATA_JS, content.POSTS_DATA_JS, RENAMES_JSON];
const TEMPLATES = ['tour.html', 'post.html', 'tours.html', 'blog.html'].map(f => path.join(content.PUBLIC, f));
let _data = { v: '' };
function data() {
  const v = SOURCES.concat(TEMPLATES).map(mtime).join('|');
  if (_data.v !== v) {
    const tours = loadList(content.TOURS_JSON, content.TOURS_DATA_JS) || [];
    const posts = loadList(content.POSTS_JSON, content.POSTS_DATA_JS) || [];
    const sights = loadList(content.SIGHTS_JSON, content.SIGHTS_DATA_JS) || {};
    _data = {
      v, tours, posts, sights,
      pubTours: content.publishedOnly(tours),
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
const template = name => fs.readFileSync(path.join(content.PUBLIC, name), 'utf8');

// ---------- <head> ----------
function headTags(m, noindex) {
  // "<" is escaped so a content value can never close the script tag
  const ld = m.jsonld ? `<script type="application/ld+json">${JSON.stringify(m.jsonld).replace(/</g, '\\u003c')}</script>\n` : '';
  return (noindex ? '<meta name="robots" content="noindex">\n' : '') +
    `<meta name="description" content="${attr(m.desc)}">\n` +
    `<link rel="canonical" href="${attr(m.url)}">\n` +
    `<meta property="og:type" content="${m.ogType}">\n` +
    `<meta property="og:site_name" content="Azat Tours">\n` +
    `<meta property="og:title" content="${attr(m.title)}">\n` +
    `<meta property="og:description" content="${attr(m.desc)}">\n` +
    `<meta property="og:url" content="${attr(m.url)}">\n` +
    (m.image ? `<meta property="og:image" content="${attr(m.image)}">\n` : '') +
    `<meta name="twitter:card" content="summary_large_image">\n` +
    `<meta name="twitter:title" content="${attr(m.title)}">\n` +
    `<meta name="twitter:description" content="${attr(m.desc)}">\n` +
    (m.image ? `<meta name="twitter:image" content="${attr(m.image)}">\n` : '') + ld;
}
// Item templates carry only a placeholder title/description; replace both.
function itemPage(tpl, mainId, m, body, noindex) {
  return template(tpl)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/i, '')
    .replace('</head>', () => headTags(m, noindex) + '</head>')
    .replace(`<main id="${mainId}"></main>`, () => `<main id="${mainId}">${body}</main>`);
}

// ---------- pages ----------
// opts.preview: also render drafts (secret-key gated by the caller), never indexed.
function tourPage(slug, opts) {
  const preview = !!(opts && opts.preview);
  const build = d => {
    const t = (preview ? d.tours.filter(x => x.status !== 'hidden') : d.pubTours).find(x => x.slug === slug);
    return t ? itemPage('tour.html', 'tourRoot', tourMeta(t), tourBody(t, d.pubTours, d.sights), preview) : null;
  };
  return preview ? build(data()) : cached('tour:' + slug, build);
}
function postPage(slug, opts) {
  const preview = !!(opts && opts.preview);
  const build = d => {
    const p = (preview ? d.posts : d.pubPosts).find(x => x.slug === slug);
    return p ? itemPage('post.html', 'postRoot', postMeta(p), postBody(p, resolveTourSlug), preview) : null;
  };
  return preview ? build(data()) : cached('post:' + slug, build);
}
function toursIndex() {
  return cached('tours', d => template('tours.html')
    .replace(/(<span id="tourCount">)[^<]*(<\/span>)/, (m, a, b) => a + d.pubTours.length + b)
    .replace('<div class="tours-grid" id="toursGrid"></div>', () => `<div class="tours-grid" id="toursGrid">${d.pubTours.map(Cards.tourCard).join('')}</div>`));
}
function blogIndex() {
  return cached('blog', d => {
    const [first, ...rest] = d.pubPosts;
    return template('blog.html')
      .replace('<div id="blogFeatured"></div>', () => `<div id="blogFeatured">${first ? Cards.postFeatured(first) : ''}</div>`)
      .replace('<div class="blog-grid" id="blogGrid"></div>', () => `<div class="blog-grid" id="blogGrid">${first ? rest.map(Cards.postCard).join('') : '<p>No articles yet.</p>'}</div>`);
  });
}

// ---------- sitemap ----------
// static pages: [path, source file, changefreq, priority]. reviews.html stays out
// (noindex until real reviews exist); builder.html stays out (app-like).
const STATIC = [
  ['/', 'index.html', 'weekly', '1.0'],
  ['/tours/', 'tours.html', 'weekly', '0.9'],
  ['/plan-trip.html', 'plan-trip.html', 'monthly', '0.8'],
  ['/blog/', 'blog.html', 'weekly', '0.7'],
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
    const entries = [
      ...STATIC.map(([loc, file, freq, pr]) => {
        // list pages change whenever any of their items does
        const extra = loc === '/tours/' ? d.pubTours.map(tourDay) : loc === '/blog/' ? d.pubPosts.map(postDay) : [];
        return url(loc, maxDay([fileDay(file), ...extra]), freq, pr);
      }),
      ...d.pubTours.map(t => url(Cards.tourUrl(t.slug), tourDay(t), 'monthly', '0.8')),
      ...d.pubPosts.map(p => url(Cards.postUrl(p.slug), postDay(p), 'monthly', '0.6')),
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
const counts = () => { const d = data(); return { tours: d.pubTours.length, posts: d.pubPosts.length }; };

module.exports = { tourPage, postPage, toursIndex, blogIndex, sitemapXml, resolveTourSlug, tourIdSlug, hasTour, hasPost, version, counts };
