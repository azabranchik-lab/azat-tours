#!/usr/bin/env node
/**
 * One spelling for the three lakes across all content: Song-Kul, Issyk-Kul,
 * Ala-Kul (the forms travellers search for). The imported texts used Song-Kol,
 * Ysyk-Kol and Ala-Kol, while tour names and static pages already said -Kul.
 *
 * Rewrites every text value in content/tours.json, posts.json, sights.json and
 * site.json. Slugs, ids, image paths and URLs are left alone (they are lowercase
 * or live in skipped fields), and the keys of sights.json do not change: the
 * tour page matches a place to its sight by a spelling-independent key.
 *
 * Idempotent. content/*.json is server-authoritative, so it runs on the server
 * through scripts/migrate.js.
 *
 *   node scripts/unify-spelling.js --dry   # count changes, write nothing
 */
const content = require('../lib/content');

const RULES = [
  [/\bSong[- ]K[oö]l\b/g, 'Song-Kul'],
  [/\b(?:Ysyk|Issyk)[- ]K[oö]l\b/g, 'Issyk-Kul'],
  [/\bAla[- ]K[oö]l\b/g, 'Ala-Kul'],
];
const SKIP = new Set(['slug', 'series', 'url', 'images', 'cover', 'photo', 'authorImg', 'id']);
// a value that is itself a path or URL (site.json photo lists etc.) is never text
const isPath = s => /^(https?:|\/|img\/|images\/)/.test(s) || /\.(jpe?g|png|webp|avif|svg)$/i.test(s);
const fix = s => isPath(s) ? s : RULES.reduce((acc, [re, to]) => acc.replace(re, to), s);

let changed = 0;
function walk(node) {
  if (Array.isArray(node)) { node.forEach((v, i) => { if (typeof v === 'string') { const f = fix(v); if (f !== v) { node[i] = f; changed++; } } else walk(v); }); return; }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (SKIP.has(k)) continue;
    if (typeof v === 'string') { const f = fix(v); if (f !== v) { node[k] = f; changed++; } }
    else walk(v);
  }
}

const dry = process.argv.includes('--dry');
const jobs = [
  ['tours', content.loadTours, content.saveTours],
  ['posts', content.loadPosts, content.savePosts],
  ['sights', content.loadSights, content.saveSights],
  ['site', content.loadSite, content.saveSite],
];
for (const [name, load, save] of jobs) {
  const data = load();
  const before = changed;
  walk(data);
  const n = changed - before;
  console.log(name + ': ' + n + ' text value(s) changed');
  if (n && !dry) save(data);
}
console.log(dry ? '(dry run, nothing written)' : (changed ? 'Content saved, data files regenerated.' : 'Nothing to change (already applied).'));

module.exports = { fix };
