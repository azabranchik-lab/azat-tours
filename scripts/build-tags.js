// Tag every tour for precise catalog filtering. Idempotent: recomputes tags[] from
// the tour's own fields each run, then regenerates tours-data.js.
// Axes: activity (multi) + duration (one) + season (one).
// Usage: node scripts/build-tags.js [--dry]
const C = require('../lib/content');

function tagsFor(t) {
  const acts = String(t.activities || '').toLowerCase();
  const cats = (t.cats || []).map(c => c.toLowerCase());
  const text = [t.name, t.activities, (t.itinerary || []).map(d => d.title).join(' ')].join(' ').toLowerCase();
  const tags = [];

  // --- activity focus (a tour can have several) ---
  if (/trekk/.test(acts)) tags.push('trekking');
  if (cats.includes('horse riding') || /horse riding\s*[–-]\s*\d+\s*day/.test(acts)) tags.push('horseback');
  if (cats.includes('road trip')) tags.push('road-trip');
  if (/off-?road|kel-?suu|kok-kiya/.test(text)) tags.push('off-road');

  // --- duration (one) ---
  const d = Number(t.days) || 0;
  tags.push(d <= 4 ? 'short' : d <= 8 ? 'week' : 'long');

  // --- season (one) ---
  const s = String(t.season || '').toLowerCase();
  tags.push(/all year/.test(s) ? 'all-year' : /^\s*nov|winter/.test(s) ? 'winter' : 'summer');

  return tags;
}

const dry = process.argv.includes('--dry');
const tours = C.loadTours();
const tally = {};
tours.forEach(t => { t.tags = tagsFor(t); t.tags.forEach(tag => tally[tag] = (tally[tag] || 0) + 1); });

console.log('Tag coverage (of ' + tours.length + '):');
Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k.padEnd(12), v));

if (!dry) { C.saveTours(tours); console.log('\nWrote content/tours.json + regenerated tours-data.js'); }
else console.log('\n(dry run — no writes)');
