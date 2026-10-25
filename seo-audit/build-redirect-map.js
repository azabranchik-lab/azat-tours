#!/usr/bin/env node
/**
 * Builds seo-audit/redirect-map.csv (old_url, new_url, confidence, comment) from the data the
 * server already uses for its 301s: scripts/_tour-renames.json (old slug -> current slug) and
 * content/*.json (current tour and post slugs). Re-run after any rename.
 *
 *   node seo-audit/build-redirect-map.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://azattours.com';

const renames = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', '_tour-renames.json'), 'utf8')).renames;
const tours = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tours.json'), 'utf8'));
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'posts.json'), 'utf8'));
const live = t => t.status !== 'draft' && t.status !== 'hidden';
const liveSlugs = new Set(tours.filter(live).map(t => t.slug));

function resolve(slug) {
  let s = slug;
  for (let i = 0; i < 6 && renames[s]; i++) s = renames[s].hide ? renames[s].redirect : renames[s].slug;
  return s;
}

const csv = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const rows = [['old_url', 'new_url', 'confidence', 'comment']];
const add = (o, n, c, m) => rows.push([ORIGIN + o, ORIGIN + n, c, m]);

// list pages
add('/tours.html', '/tours/', 'high', 'old catalog page');
add('/blog.html', '/blog/', 'high', 'old blog index');
add('/tour.html', '/tours/', 'high', 'template without slug: only the catalog makes sense');
add('/post.html', '/blog/', 'high', 'template without slug: only the blog index makes sense');
add('/index.html', '/', 'high', 'home');

// renamed / retired tours (scripts/_tour-renames.json, 2026-10-13 rename)
for (const [old, r] of Object.entries(renames)) {
  const target = resolve(old);
  if (!liveSlugs.has(target)) { add('/tour.html?slug=' + old, '/tours/', 'LOW', 'target slug "' + target + '" is not live; check'); continue; }
  const t = tours.find(x => x.slug === target);
  if (r.hide) add('/tour.html?slug=' + old, '/tours/' + target + '/', 'medium', 'tour retired 2026-10-13 as a near-duplicate; merged into "' + t.name + '" (owner decision at the time, please confirm)');
  else add('/tour.html?slug=' + old, '/tours/' + target + '/', 'high', 'same tour renamed 2026-10-13: "' + r.name + '"');
  add('/tours/' + old + '/', '/tours/' + target + '/', 'high', 'old slug on the new URL pattern (same mapping)');
}

// the same tour under the old URL pattern, by slug and by numeric id
for (const t of tours.filter(live)) {
  add('/tour.html?slug=' + t.slug, '/tours/' + t.slug + '/', 'high', 'same slug, old URL pattern');
  add('/tour.html?id=' + t.id, '/tours/' + t.slug + '/', 'high', 'old id-based address');
}
for (const p of posts.filter(live)) add('/post.html?slug=' + p.slug, '/blog/' + p.slug + '/', 'high', 'same slug, old URL pattern');

// unknown slugs: the one allowed catalog redirect (today the server answers 404 instead)
rows.push([ORIGIN + '/tour.html?slug=<unknown>', ORIGIN + '/tours/', 'n/a', 'fallback for a slug nobody knows; currently a real 404 (decision pending)']);
rows.push([ORIGIN + '/post.html?slug=<unknown>', ORIGIN + '/blog/', 'n/a', 'fallback; currently a real 404 (decision pending)']);

fs.writeFileSync(path.join(__dirname, 'redirect-map.csv'), rows.map(r => r.map(csv).join(',')).join('\n') + '\n');
const conf = rows.slice(1).reduce((a, r) => (a[r[2]] = (a[r[2]] || 0) + 1, a), {});
console.log('redirect-map.csv: ' + (rows.length - 1) + ' rows', JSON.stringify(conf));
