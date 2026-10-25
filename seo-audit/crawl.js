#!/usr/bin/env node
/**
 * SEO baseline crawler (no JS executed, like a crawler's first pass).
 *
 *   node seo-audit/crawl.js <base-url> <out-dir>
 *   node seo-audit/crawl.js https://azattours.com seo-audit/baseline/prod
 *   node seo-audit/crawl.js http://localhost:5173 seo-audit/baseline/local
 *
 * Writes into <out-dir>:
 *   pages.csv      every URL from sitemap.xml (+ extra known pages): status, title, description,
 *                  canonical, H1, word count, noindex, JSON-LD types, og:image, sitemap lastmod
 *   pages.json     the same, machine-readable (used by compare.js)
 *   old-urls.csv   every known old address: first status, Location, final status after redirects
 *   links.csv      every internal link found on crawled pages that does not answer 200 directly
 *   summary.txt    counts and duplicate titles/descriptions
 *   sitemap.xml    copy of the sitemap as served
 *
 * Extra old addresses (one path per line) can be listed in seo-audit/old-urls-extra.txt.
 */
const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '');
const OUT = process.argv[3] || path.join(__dirname, 'baseline', 'run');
const ORIGIN = 'https://azattours.com';
fs.mkdirSync(OUT, { recursive: true });

// Pages that are deliberately not in the sitemap but exist (noindex/app-like); still recorded.
const EXTRA_PAGES = ['/builder.html', '/reviews.html', '/404.html', '/llms.txt', '/llms-full.txt'];

const get = (url, opts) => fetch(url, Object.assign({ redirect: 'manual', headers: { 'User-Agent': 'azat-seo-baseline/1.0' } }, opts));
const pick = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };
const unesc = s => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const csv = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const row = arr => arr.map(csv).join(',') + '\n';

function wordCount(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  return unesc(body).split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
}
function ldTypes(html) {
  const types = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { for (const n of [].concat(JSON.parse(m[1]))) types.push(n['@type']); } catch (e) { types.push('INVALID'); }
  }
  return types.join('|');
}
function h1s(html) {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => unesc(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()));
}

// Follow redirects by hand so every hop is recorded.
async function follow(pathName, max = 5) {
  const hops = [];
  let url = BASE + pathName;
  for (let i = 0; i < max; i++) {
    const res = await get(url);
    let loc = res.headers.get('location') || '';
    hops.push({ status: res.status, location: loc });
    if (res.status < 300 || res.status >= 400 || !loc) break;
    if (loc.startsWith(ORIGIN)) loc = loc.slice(ORIGIN.length) || '/';
    url = loc.startsWith('/') ? BASE + loc : loc;
  }
  return hops;
}

async function main() {
  const smRes = await get(BASE + '/sitemap.xml');
  const sm = await smRes.text();
  const entries = [...sm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?/g)]
    .map(m => ({ loc: m[1].replace(ORIGIN, '') || '/', lastmod: m[2] || '', inSitemap: true }));
  for (const p of EXTRA_PAGES) if (!entries.some(e => e.loc === p)) entries.push({ loc: p, lastmod: '', inSitemap: false });
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sm);

  const pages = [], links = new Map();
  for (const e of entries) {
    const res = await get(BASE + e.loc);
    const html = await res.text();
    const isHtml = /text\/html/.test(res.headers.get('content-type') || '');
    const imgs = isHtml ? [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]) : [];
    const rec = {
      url: e.loc, inSitemap: e.inSitemap, lastmod: e.lastmod, status: res.status,
      title: isHtml ? unesc(pick(html, /<title>([^<]*)<\/title>/)) : '',
      description: isHtml ? unesc(pick(html, /<meta name="description" content="([^"]*)"/)) : '',
      canonical: isHtml ? pick(html, /<link rel="canonical" href="([^"]*)"/) : '',
      h1: isHtml ? h1s(html) : [],
      words: isHtml ? wordCount(html) : html.split(/\s+/).length,
      noindex: /<meta name="robots" content="[^"]*noindex/.test(html) || /noindex/.test(res.headers.get('x-robots-tag') || ''),
      ldTypes: isHtml ? ldTypes(html) : '',
      ogImage: isHtml ? pick(html, /<meta property="og:image" content="([^"]*)"/) : '',
      bytes: Buffer.byteLength(html),
      imgCount: imgs.length,
      imgNoAlt: imgs.filter(s => !/\salt="/.test(s)).length,
      imgNoLazy: imgs.filter(s => !/loading="lazy"/.test(s)).length,
      imgNoSize: imgs.filter(s => !(/\swidth=/.test(s) && /\sheight=/.test(s))).length,
    };
    rec.canonicalOk = rec.canonical === ORIGIN + e.loc;
    pages.push(rec);
    if (isHtml) for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      let h = unesc(m[1]);
      if (h.startsWith(ORIGIN)) h = h.slice(ORIGIN.length) || '/';
      if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(h)) continue;
      if (!h.startsWith('/')) h = '/' + h;
      h = h.split('#')[0];
      if (!links.has(h)) links.set(h, e.loc);
    }
    process.stdout.write('.');
  }
  console.log('\n' + pages.length + ' pages crawled');

  // ---- known old addresses ----
  const renames = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', '_tour-renames.json'), 'utf8')).renames;
  const tourSlugs = pages.filter(p => /^\/tours\/[^/]+\/$/.test(p.url)).map(p => p.url.split('/')[2]);
  const postSlugs = pages.filter(p => /^\/blog\/[^/]+\/$/.test(p.url)).map(p => p.url.split('/')[2]);
  const old = new Set(['/tour.html', '/post.html', '/tours.html', '/blog.html', '/index.html', '/tours', '/blog']);
  for (const s of Object.keys(renames)) { old.add('/tour.html?slug=' + s); old.add('/tours/' + s + '/'); }
  for (const s of tourSlugs) { old.add('/tour.html?slug=' + s); old.add('/tours/' + s); }
  for (const s of postSlugs) { old.add('/post.html?slug=' + s); old.add('/blog/' + s); }
  const extraOld = path.join(__dirname, 'old-urls-extra.txt');
  if (fs.existsSync(extraOld)) for (const l of fs.readFileSync(extraOld, 'utf8').split(/\r?\n/)) if (l.trim() && !l.startsWith('#')) old.add(l.trim().replace(ORIGIN, ''));
  old.add('/tour.html?slug=does-not-exist'); old.add('/tours/does-not-exist/'); old.add('/post.html?slug=does-not-exist');

  let oldCsv = row(['old_url', 'first_status', 'location', 'hops', 'final_status', 'final_url']);
  const oldRecs = [];
  for (const o of [...old].sort()) {
    const hops = await follow(o);
    const last = hops[hops.length - 1];
    let finalUrl = '';
    for (const h of hops) if (h.location) finalUrl = h.location.replace(ORIGIN, '');
    const rec = { old: o, first: hops[0].status, location: hops[0].location.replace(ORIGIN, ''), hops: hops.length - 1, final: last.status, finalUrl };
    oldRecs.push(rec);
    oldCsv += row([rec.old, rec.first, rec.location, rec.hops, rec.final, rec.finalUrl]);
  }
  fs.writeFileSync(path.join(OUT, 'old-urls.csv'), oldCsv);

  // ---- internal links ----
  let linkCsv = row(['link', 'status', 'location', 'found_on']), bad = 0;
  for (const [h, from] of links) {
    const res = await get(BASE + h, { method: /\.(jpe?g|png|webp|avif|svg|ico)$/i.test(h) ? 'HEAD' : 'GET' });
    if (res.status !== 200) { bad++; linkCsv += row([h, res.status, (res.headers.get('location') || '').replace(ORIGIN, ''), from]); }
  }
  fs.writeFileSync(path.join(OUT, 'links.csv'), linkCsv);

  // ---- write pages ----
  let pcsv = row(['url', 'in_sitemap', 'lastmod', 'status', 'noindex', 'title', 'title_len', 'description', 'desc_len', 'canonical_ok', 'canonical', 'h1_count', 'h1', 'words', 'ld_types', 'og_image', 'bytes', 'img_count', 'img_no_alt', 'img_no_lazy', 'img_no_size']);
  for (const p of pages) pcsv += row([p.url, p.inSitemap, p.lastmod, p.status, p.noindex, p.title, p.title.length, p.description, p.description.length, p.canonicalOk, p.canonical, p.h1.length, p.h1.join(' || '), p.words, p.ldTypes, p.ogImage, p.bytes, p.imgCount, p.imgNoAlt, p.imgNoLazy, p.imgNoSize]);
  fs.writeFileSync(path.join(OUT, 'pages.csv'), pcsv);
  fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify({ base: BASE, crawledAt: new Date().toISOString(), pages, oldUrls: oldRecs }, null, 1));

  // ---- summary ----
  const idx = pages.filter(p => p.inSitemap);
  const dup = key => { const m = new Map(); for (const p of idx.filter(p => p[key])) m.set(p[key], (m.get(p[key]) || []).concat(p.url)); return [...m].filter(([, v]) => v.length > 1); };
  const isListOrHome = r => /^\/(tours|blog|index)(\.html)?$|^\/(tour|post)\.html$/.test(r.old);
  const toCatalog = oldRecs.filter(r => r.first === 301 && /^\/(tours\/|blog\/)?$/.test(r.location) && !isListOrHome(r));
  const lines = [
    'base: ' + BASE + '   crawled: ' + new Date().toISOString(),
    'sitemap URLs: ' + idx.length + ' (tours ' + idx.filter(p => /^\/tours\/.+/.test(p.url)).length + ', posts ' + idx.filter(p => /^\/blog\/.+/.test(p.url)).length + ')',
    'non-200 in sitemap: ' + (idx.filter(p => p.status !== 200).map(p => p.url + ' ' + p.status).join(', ') || 'none'),
    'noindex in sitemap: ' + (idx.filter(p => p.noindex).map(p => p.url).join(', ') || 'none'),
    'canonical mismatch: ' + (idx.filter(p => !p.canonicalOk).map(p => p.url + ' -> ' + p.canonical).join(', ') || 'none'),
    'h1 count != 1: ' + (idx.filter(p => p.h1.length !== 1).map(p => p.url + ' (' + p.h1.length + ')').join(', ') || 'none'),
    'missing title: ' + idx.filter(p => !p.title).length + ', missing description: ' + idx.filter(p => !p.description).length,
    'title > 60: ' + idx.filter(p => p.title.length > 60).length + ', description > 158: ' + idx.filter(p => p.description.length > 158).length,
    'duplicate titles: ' + (dup('title').map(([t, u]) => '"' + t + '" <- ' + u.join(' ')).join('; ') || 'none'),
    'duplicate descriptions: ' + (dup('description').map(([t, u]) => '"' + t.slice(0, 50) + '..." <- ' + u.join(' ')).join('; ') || 'none'),
    'img total: ' + idx.reduce((a, p) => a + p.imgCount, 0) + ', without alt: ' + idx.reduce((a, p) => a + p.imgNoAlt, 0) + ', without width/height: ' + idx.reduce((a, p) => a + p.imgNoSize, 0) + ', without lazy: ' + idx.reduce((a, p) => a + p.imgNoLazy, 0),
    'old URLs checked: ' + oldRecs.length + '; 301: ' + oldRecs.filter(r => r.first === 301).length + '; 404: ' + oldRecs.filter(r => r.first === 404).length + '; 200: ' + oldRecs.filter(r => r.first === 200).length + '; chains (>1 hop): ' + oldRecs.filter(r => r.hops > 1).length + '; item URL redirected to catalog/home: ' + (toCatalog.map(r => r.old).join(', ') || 'none'),
    'internal links/assets checked: ' + links.size + '; not 200: ' + bad,
  ];
  fs.writeFileSync(path.join(OUT, 'summary.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
