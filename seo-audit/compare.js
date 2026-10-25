#!/usr/bin/env node
/**
 * Compares two crawls made by seo-audit/crawl.js and prints every difference that matters
 * for indexing: pages missing on either side, status, canonical, noindex, title, H1,
 * description, JSON-LD types, and old URLs whose redirect target changed.
 *
 *   node seo-audit/compare.js seo-audit/baseline/prod seo-audit/runs/local     # local build vs the reference
 *   node seo-audit/compare.js seo-audit/baseline/prod seo-audit/runs/prod-...  # production vs the reference
 *
 * Exit code 1 when a page from the first crawl is missing, not 200, or has a different canonical.
 */
const fs = require('fs');
const path = require('path');
const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: compare.js <dir-before> <dir-after>'); process.exit(2); }
const load = d => JSON.parse(fs.readFileSync(path.join(d, 'pages.json'), 'utf8'));
const A = load(a), B = load(b);
const byUrl = c => new Map(c.pages.map(p => [p.url, p]));
const pa = byUrl(A), pb = byUrl(B);
let hard = 0, soft = 0;
const out = [];
for (const [url, p] of pa) {
  const q = pb.get(url);
  if (!q) { hard++; out.push('MISSING  ' + url); continue; }
  if (p.status !== q.status) { hard++; out.push('STATUS   ' + url + ': ' + p.status + ' -> ' + q.status); }
  if (p.canonical !== q.canonical) { hard++; out.push('CANONICAL ' + url + ': ' + p.canonical + ' -> ' + q.canonical); }
  if (p.noindex !== q.noindex) { hard++; out.push('NOINDEX  ' + url + ': ' + p.noindex + ' -> ' + q.noindex); }
  if (p.title !== q.title) { soft++; out.push('TITLE    ' + url + ':\n   - ' + p.title + '\n   + ' + q.title); }
  if (p.h1.join('|') !== q.h1.join('|')) { soft++; out.push('H1       ' + url + ':\n   - ' + p.h1.join(' || ') + '\n   + ' + q.h1.join(' || ')); }
  if (p.description !== q.description) { soft++; out.push('DESC     ' + url + ':\n   - ' + p.description + '\n   + ' + q.description); }
  if (p.ldTypes !== q.ldTypes) { soft++; out.push('JSON-LD  ' + url + ': ' + p.ldTypes + ' -> ' + q.ldTypes); }
  if (p.inSitemap !== q.inSitemap) { soft++; out.push('SITEMAP  ' + url + ': ' + p.inSitemap + ' -> ' + q.inSitemap); }
}
for (const url of pb.keys()) if (!pa.has(url)) { soft++; out.push('NEW      ' + url); }
const oa = new Map(A.oldUrls.map(r => [r.old, r])), ob = new Map(B.oldUrls.map(r => [r.old, r]));
for (const [old, r] of oa) {
  const s = ob.get(old);
  if (!s) { out.push('OLD?     ' + old + ' not checked in the second crawl'); continue; }
  if (r.first !== s.first || r.location !== s.location) { hard++; out.push('REDIRECT ' + old + ': ' + r.first + ' ' + r.location + ' -> ' + s.first + ' ' + s.location); }
}
console.log(out.join('\n') || 'no differences');
console.log('\n' + A.pages.length + ' pages in ' + a + ', ' + B.pages.length + ' in ' + b + '; ' + hard + ' hard difference(s) (status/canonical/noindex/redirect/missing), ' + soft + ' soft (title/H1/description/JSON-LD/sitemap)');
process.exit(hard ? 1 : 0);
