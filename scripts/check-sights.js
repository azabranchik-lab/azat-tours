#!/usr/bin/env node
/**
 * "Sights visited on this tour" must match the tour: every place in a tour's places[] has to be
 * named somewhere in its text (name, summary, highlights, day titles and descriptions, overnight,
 * transfer, activity). places[] was generated once from old day titles (scripts/build-places.js)
 * and routes were rewritten since, so a stale entry shows a lake the tour never reaches.
 *
 *   node scripts/check-sights.js             # table on stdout, exit 1 when a shown place is unmentioned
 *   node scripts/check-sights.js --csv out.csv
 *
 * Spellings come from the gazetteer patterns in build-places.js plus a few places only the 2026
 * tour pack visits. "Mentioned but not shown" rows are suggestions for the owner, never applied.
 */
const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

const src = fs.readFileSync(path.join(__dirname, 'build-places.js'), 'utf8');
const GAZ = [...src.matchAll(/\{ key: '([^']+)',\s*name: '([^']+)'.*?pat: (\/.+?\/i) \}/g)]
  .map(m => ({ key: m[1], name: m[2], pat: new RegExp(m[3].slice(1, -2), 'i') }));
const EXTRA = {
  'ala-archa': /Ala[-\s]?Archa/i, burana: /Burana/i, chunkurchak: /Chunkurchak/i, konorchek: /Konorch[eo]k/i,
  barskoon: /Barskoon/i, jyrgalan: /Jyrgalan/i, 'kol-tor': /Kol[-\s]?Tor/i, kilemche: /Kilemche/i, 'mai-tor': /Mai[-\s]?Tor/i,
  'ichke-tor': /Ichke[-\s]?Tor/i, 'kok-bulak': /Kok[-\s]?Bulak/i, balykchy: /Balykchy/i, arashan: /Arashan/i, 'kok-moynok': /Kok[-\s]?Moynok/i,
};
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tourText = t => [t.name, t.summary, ...(t.highlights || []), ...(t.itinerary || []).flatMap(d => [d.title, ...(Array.isArray(d.desc) ? d.desc : [d.desc]), d.overnight, d.transfer, d.activity])].filter(Boolean).join(' \n ');
// the label may carry a note after "·" ("Bishkek · start & finish"); match the place only
const label = name => String(name).replace(/·.*/, '').trim();
function patternFor(name) {
  const n = label(name);
  const g = GAZ.find(x => x.name === n);
  if (g) return g.pat;
  const key = Object.keys(EXTRA).find(k => norm(n).replace(/[^a-z]+/g, '-').includes(k));
  if (key) return EXTRA[key];
  const core = norm(n).replace(/\b(lake|valley|town|village|pass|gorge)\b/g, '').trim();
  return new RegExp(core.replace(/[^a-z0-9]+/g, '[-\\s]?'), 'i');
}
function mentioned(place, text) { const p = patternFor(place); return p.test(text) || p.test(norm(text)); }

function check(tours) {
  const rows = [];
  for (const t of tours) {
    const text = tourText(t);
    const places = ((t.places && t.places.length) ? t.places : (t.route || [])).map(p => p.name).filter(Boolean);
    for (const name of places) if (!mentioned(name, text)) rows.push({ slug: t.slug, place: name, shown: true, mentioned: false, verdict: 'remove: not in the itinerary or description' });
    for (const g of GAZ) {
      if (g.key === 'bishkek' || !g.pat.test(text)) continue;
      if (!places.some(n => n === g.name || mentioned(n, g.name) || patternFor(n).test(g.name))) rows.push({ slug: t.slug, place: g.name, shown: false, mentioned: true, verdict: 'suggest: named in the text, not shown' });
    }
  }
  return rows;
}

if (require.main === module) {
  const tours = content.publishedOnly(content.loadTours());
  const rows = check(tours);
  const bad = rows.filter(r => r.shown && !r.mentioned);
  const csvAt = process.argv.indexOf('--csv');
  if (csvAt > 0) {
    const q = v => /[",]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
    fs.writeFileSync(process.argv[csvAt + 1], ['tour,place,shown,mentioned,verdict', ...rows.map(r => [r.slug, r.place, r.shown ? 'yes' : 'no', r.mentioned ? 'yes' : 'no', r.verdict].map(q).join(','))].join('\n') + '\n');
  }
  console.log(`${tours.length} tours; shown but not mentioned: ${bad.length}; mentioned but not shown (suggestions): ${rows.length - bad.length}`);
  bad.forEach(r => console.log('  ' + r.slug + '  |  ' + r.place));
  if (bad.length) process.exit(1);
}
module.exports = { check, mentioned, patternFor, GAZ };
