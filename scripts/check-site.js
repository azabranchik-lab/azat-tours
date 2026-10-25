#!/usr/bin/env node
/**
 * SEO + link check against a running site (no JS executed, like a crawler).
 *
 *   node server.js                      # in one terminal
 *   node scripts/check-site.js          # checks http://localhost:5173
 *   node scripts/check-site.js https://azattours.com
 *
 * For every URL in sitemap.xml: 200, unique <title>, meta description, canonical
 * equal to the sitemap URL, exactly one <h1>, no noindex, valid JSON-LD with the
 * expected types. Then every internal link and asset on those pages must answer
 * 200 directly (a redirect means some page still links to an old address).
 * Exit code 1 when anything fails.
 */
const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '');
const ORIGIN = 'https://azattours.com';
const problems = [];
const bad = (url, msg) => problems.push(url + '  ' + msg);

const get = (url, opts) => fetch(url, Object.assign({ redirect: 'manual' }, opts));
const pick = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };
const unescape = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function ldTypes(html, url) {
  const types = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let json;
    try { json = JSON.parse(m[1]); } catch (e) { bad(url, 'JSON-LD does not parse: ' + e.message); continue; }
    for (const node of [].concat(json)) {
      if (node['@context'] !== 'https://schema.org') bad(url, 'JSON-LD without schema.org @context');
      types.push(node['@type']);
      if (node['@type'] === 'TouristTrip' && !(node.name && node.description && node.itinerary && node.provider)) bad(url, 'TouristTrip misses name/description/itinerary/provider');
      if (node['@type'] === 'TouristTrip' && node.offers && !(node.offers.price > 0 && node.offers.priceCurrency && node.offers.priceSpecification && node.offers.priceSpecification.minPrice > 0)) bad(url, 'TouristTrip offer without a starting price');
      if (node['@type'] === 'TouristTrip' && node.aggregateRating) bad(url, 'TouristTrip carries a rating (no real reviews yet)');
      if (node['@type'] === 'BlogPosting' && !(node.headline && node.description && node.image && node.datePublished && node.dateModified && node.author && node.publisher)) bad(url, 'BlogPosting misses a required field');
      if (node['@type'] === 'BlogPosting' && !(node.author && node.author['@type'] === 'Person' && node.author.url)) bad(url, 'BlogPosting author is not a Person with a page');
      if (node['@type'] === 'Product' && !(node.name && node.image && node.offers && [].concat(node.offers).every(o => o.price > 0 && o.priceCurrency))) bad(url, 'Product misses name/image/offers with a price');
      if (node['@type'] === 'BreadcrumbList' && !(node.itemListElement || []).every(i => i.name && i.item)) bad(url, 'BreadcrumbList item without name/item');
      if (node['@type'] === 'FAQPage' && !(node.mainEntity || []).every(q => q.name && q.acceptedAnswer && q.acceptedAnswer.text)) bad(url, 'FAQPage question without answer');
    }
  }
  return types;
}

async function main() {
  const sm = await (await get(BASE + '/sitemap.xml')).text();
  if (!/^<\?xml[^>]*\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sm)) bad('/sitemap.xml', 'not a sitemap urlset');
  const entries = [...sm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)].map(m => ({ loc: m[1], lastmod: m[2] }));
  entries.forEach(e => { if (!/^\d{4}-\d{2}-\d{2}$/.test(e.lastmod)) bad(e.loc, 'bad lastmod'); if (/\?|\.html\?/.test(e.loc)) bad(e.loc, 'query-string URL in sitemap'); });
  const robots = await (await get(BASE + '/robots.txt')).text();
  if (!/Sitemap:\s*https:\/\/azattours\.com\/sitemap\.xml/.test(robots)) bad('/robots.txt', 'no Sitemap line');
  if (/^Disallow:\s*\/\s*$/m.test(robots)) bad('/robots.txt', 'site is closed to crawlers');

  const llms = await get(BASE + '/llms.txt');
  if (llms.status !== 200 || !/^# Azat Tours/.test(await llms.text())) bad('/llms.txt', 'missing or malformed');

  const titles = new Map(), descs = new Map(), links = new Map();
  let tours = 0, posts = 0, cars = 0;
  for (const { loc } of entries) {
    const pathName = loc.replace(ORIGIN, '');
    const res = await get(BASE + pathName);
    if (res.status !== 200) { bad(pathName, 'status ' + res.status); continue; }
    const html = await res.text();
    const title = unescape(pick(html, /<title>([^<]*)<\/title>/)), desc = pick(html, /<meta name="description" content="([^"]*)"/);
    const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (!title) bad(pathName, 'no title'); else if (titles.has(title)) bad(pathName, 'duplicate title with ' + titles.get(title)); else titles.set(title, pathName);
    if (title.length > 60) console.log('note: title longer than 60 (' + title.length + '), Google may cut it: ' + pathName);
    if (!desc) bad(pathName, 'no meta description'); else if (descs.has(desc)) bad(pathName, 'duplicate description with ' + descs.get(desc)); else descs.set(desc, pathName);
    if (canonical !== loc) bad(pathName, 'canonical is "' + canonical + '"');
    if (h1 !== 1) bad(pathName, h1 + ' <h1> elements');
    if (/<meta name="robots" content="[^"]*noindex/.test(html) || /noindex/.test(res.headers.get('x-robots-tag') || '')) bad(pathName, 'noindex');
    if (!/<meta property="og:image" content="https:\/\/[^"]+"/.test(html)) bad(pathName, 'no absolute og:image');
    const types = ldTypes(html, pathName);
    const isTour = /^\/tours\/[^/]+\/$/.test(pathName), isPost = /^\/blog\/[^/]+\/$/.test(pathName), isCar = /^\/cars\/[^/]+\/$/.test(pathName);
    if (isCar) { cars++; ['Product', 'BreadcrumbList'].forEach(t => types.includes(t) || bad(pathName, 'no ' + t + ' JSON-LD')); if (!/id="leadForm"/.test(html)) bad(pathName, 'request form missing from HTML'); }
    if (pathName === '/cars/' && !/<a class="tour car-card" href="\/cars\//.test(html)) bad(pathName, 'car list missing from HTML');
    if (isTour) { tours++; ['TouristTrip', 'BreadcrumbList'].forEach(t => types.includes(t) || bad(pathName, 'no ' + t + ' JSON-LD')); if (!/class="timeline"/.test(html)) bad(pathName, 'itinerary missing from HTML'); }
    if (isPost) { posts++; ['BlogPosting', 'BreadcrumbList'].forEach(t => types.includes(t) || bad(pathName, 'no ' + t + ' JSON-LD')); if (!/<article class="article">\s*<[a-z]/.test(html)) bad(pathName, 'article text missing from HTML'); }
    if (pathName === '/' && !types.includes('TravelAgency')) bad(pathName, 'no TravelAgency JSON-LD');
    if (pathName === '/' && !types.includes('WebSite')) bad(pathName, 'no WebSite JSON-LD');
    if (isTour && !/href="\/blog\/[a-z0-9-]+\/"/.test(html)) bad(pathName, 'tour page links to no article');
    if (!/<main[\s>]/.test(html)) bad(pathName, 'no <main> landmark');
    if (pathName === '/tours/' && (html.match(/<a class="tour" href="\/tours\//g) || []).length < 1) bad(pathName, 'tour list missing from HTML');
    if (pathName === '/blog/' && !/href="\/blog\/[a-z0-9-]+\/"/.test(html)) bad(pathName, 'post list missing from HTML');
    if (!/<header id="header"/.test(html) || !/<footer>/.test(html)) bad(pathName, 'navigation or footer missing from HTML');
    if (isTour || isPost || isCar) { const md = await get(BASE + pathName.replace(/\/$/, '.md')); if (md.status !== 200 || !/^# /.test(await md.text())) bad(pathName, 'no Markdown version'); }
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      if (!/\salt="/.test(m[0])) bad(pathName, 'img without alt: ' + m[0].slice(0, 80));
      if (/\ssrc="\/?(img|images)\//.test(m[0]) && !(/\swidth="\d+"/.test(m[0]) && /\sheight="\d+"/.test(m[0]))) bad(pathName, 'img without width/height: ' + m[0].slice(0, 80));
    }
    // speed contract (2026-10-25): fonts from this domain, versioned stylesheet, first screen visible without JS
    if (/fonts\.(googleapis|gstatic)\.com/.test(html)) bad(pathName, 'still loads Google Fonts');
    if (!/href="\/styles\.css\?v=[a-z0-9]+"/.test(html)) bad(pathName, 'stylesheet URL is not versioned');
    const hero = html.match(/<section class="(?:page-)?hero[^>]*>[\s\S]*?<\/section>/);
    if (hero && /class="[^"]*\breveal\b(?![^"]*\bin\b)[^"]*"/.test(hero[0])) bad(pathName, 'hero element hidden until window.load');
    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      let h = unescape(m[1]);
      if (h.startsWith(ORIGIN)) h = h.slice(ORIGIN.length) || '/';
      if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(h)) continue;                     // external, mailto:, tel:, #anchor
      if (!h.startsWith('/')) { bad(pathName, 'relative URL "' + h + '"'); continue; }
      h = h.split('#')[0];
      if (!links.has(h)) links.set(h, pathName);
    }
  }

  for (const [h, from] of links) {
    const res = await get(BASE + h, { method: /\.(jpe?g|png|webp|avif)$/i.test(h) ? 'HEAD' : 'GET' });
    if (res.status !== 200) bad(h, 'status ' + res.status + (res.headers.get('location') ? ' -> ' + res.headers.get('location') : '') + ' (linked from ' + from + ')');
  }

  console.log(`${entries.length} sitemap URLs (${tours} tours, ${posts} posts, ${cars} cars), ${links.size} internal links and assets checked on ${BASE}`);
  if (problems.length) { console.log('\n' + problems.length + ' problem(s):\n' + problems.join('\n')); process.exit(1); }
  console.log('All good.');
}
main().catch(e => { console.error(e); process.exit(1); });
