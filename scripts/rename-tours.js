#!/usr/bin/env node
/**
 * Idempotent tour rename: applies scripts/_tour-renames.json to the content.
 *
 * For every entry "<old slug>": { slug, name } the tour gets its new name and
 * slug (plus optional field fixes like days/duration). "<old slug>": { hide:
 * true, redirect } marks the tour status 'hidden' instead: it stays in
 * content/tours.json (nothing is deleted) but leaves the public data, the
 * catalogue and the sitemap. Tour links inside blog post bodies are re-pointed
 * to the new slugs, and anchors that quoted an old tour name are reworded.
 *
 * Each renamed tour keeps a `series` key derived from its OLD name, because the
 * "Also available as" length variants on the tour page used to be grouped by
 * identical names and the new names are unique.
 *
 * The same map is the source of the 301 redirects from the old URLs.
 *
 * ⚠ DEPLOY: content/*.json is server-authoritative, so run this ONCE on the
 * server after unpacking, before regenerating data and the sitemap:
 *     node scripts/rename-tours.js
 *
 *   node scripts/rename-tours.js --dry   # preview, write nothing
 */
const content = require('../lib/content');
const { renames, anchors } = require('./_tour-renames.json');

const dry = process.argv.includes('--dry');
const seriesKey = name => content.slugify(String(name).replace(/\s*-\s*\d+\s*Days?\s*$/i, ''));

function main() {
  const tours = content.loadTours();
  const posts = content.loadPosts();
  const bySlug = Object.fromEntries(tours.map(t => [t.slug, t]));
  let renamed = 0, hidden = 0, links = 0;
  const missing = [];

  for (const [from, r] of Object.entries(renames)) {
    const t = bySlug[from];
    if (r.hide) {
      if (!t) { missing.push(from); continue; }
      if (t.status !== 'hidden') { console.log('HIDE  ' + from); t.status = 'hidden'; hidden++; }
      continue;
    }
    if (!t) { if (!bySlug[r.slug]) missing.push(from); continue; }   // already renamed -> skip
    if (bySlug[r.slug] && bySlug[r.slug] !== t) throw new Error('slug already taken: ' + r.slug);
    console.log('NAME  ' + t.name + '\n   -> ' + r.name + '\n      ' + from + ' -> ' + r.slug + '\n');
    if (!t.series) t.series = seriesKey(t.name);
    const { slug, name, ...fixes } = r;
    Object.assign(t, fixes, { name, slug });
    renamed++;
  }

  // Re-point tour links in post bodies; reword anchors that named an old tour.
  const target = from => { const r = renames[from]; return r ? (r.hide ? r.redirect : r.slug) : null; };
  for (const p of posts) {
    p.body = String(p.body || '').replace(/\[([^\]]+)\]\(tour\.html\?slug=([a-z0-9-]+)\)/g, (m, text, slug) => {
      const to = target(slug);
      if (!to) return m;
      links++;
      return '[' + (anchors[text] || text) + '](tour.html?slug=' + to + ')';
    });
  }

  if (missing.length) console.log('⚠ not found (neither old nor new slug): ' + missing.join(', '));
  console.log(renamed + ' tour(s) renamed, ' + hidden + ' hidden, ' + links + ' post link(s) re-pointed.');
  if (dry) { console.log('(dry run, nothing written)'); return; }
  if (renamed || hidden) content.saveTours(tours);
  if (links) content.savePosts(posts);
  console.log(renamed || hidden || links ? 'Wrote content + regenerated data files.' : 'Nothing to change (already applied).');
}

main();
