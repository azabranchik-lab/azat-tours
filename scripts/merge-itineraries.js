// Merge enriched per-day itineraries into content/tours.json, then rebuild tours-data.js.
//
// Source: scripts/_itin/<slug>.json  — each file is EITHER
//   (a) an array  = the tour's itinerary, OR
//   (b) an object { itinerary:[...], gallery?:[...] } for richer merges.
//
// Only the `itinerary` (and optional gallery) of matching tours is replaced;
// every other field (price, cats, tags, images, places, etc.) is left untouched.
// Idempotent: re-running with the same files reproduces the same result.
//
// Usage: node scripts/merge-itineraries.js [--dry]

const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

const ITIN_DIR = path.join(__dirname, '_itin');
const DRY = process.argv.includes('--dry');

const DAY_FIELDS = ['day', 'title', 'desc', 'transfer', 'activity', 'meals', 'overnight', 'wc', 'internet'];

function normDay(d, i) {
  const out = {};
  out.day = Number(d.day) || i + 1;
  out.title = String(d.title || '').trim();
  out.desc = Array.isArray(d.desc) ? d.desc.map(p => String(p).trim()).filter(Boolean)
           : (d.desc ? [String(d.desc).trim()] : []);
  for (const f of ['transfer', 'activity', 'meals', 'overnight', 'wc', 'internet']) {
    out[f] = d[f] != null ? String(d[f]).trim() : '';
  }
  return out;
}

function main() {
  if (!fs.existsSync(ITIN_DIR)) {
    console.error('No _itin dir at', ITIN_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(ITIN_DIR).filter(f => f.endsWith('.json'));
  if (!files.length) { console.error('No *.json in', ITIN_DIR); process.exit(1); }

  const tours = content.loadTours();
  const bySlug = Object.fromEntries(tours.map(t => [t.slug, t]));

  let applied = 0; const report = []; const missing = [];
  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const tour = bySlug[slug];
    if (!tour) { missing.push(slug); continue; }
    const raw = JSON.parse(fs.readFileSync(path.join(ITIN_DIR, file), 'utf8'));
    const itin = Array.isArray(raw) ? raw : raw.itinerary;
    if (!Array.isArray(itin) || !itin.length) { report.push(`${slug}: SKIP (empty itinerary)`); continue; }
    const norm = itin.map(normDay);

    // sanity: day count should match the tour's stated length (warn, don't block)
    const expected = (tour.itinerary || []).length;
    const flag = expected && norm.length !== expected ? `  ⚠ days ${norm.length} vs ${expected}` : '';

    tour.itinerary = norm;
    if (!Array.isArray(raw) && Array.isArray(raw.gallery) && raw.gallery.length) tour.gallery = raw.gallery;

    // richness metric
    const withDesc = norm.filter(d => d.desc.length).length;
    report.push(`${slug}: ${norm.length} days, ${withDesc} with desc${flag}`);
    applied++;
  }

  console.log(report.sort().join('\n'));
  if (missing.length) console.log('\nNO MATCHING TOUR for:', missing.join(', '));
  console.log(`\n${applied} tours updated${DRY ? ' (dry run — nothing written)' : ''}.`);

  if (!DRY && applied) {
    content.saveTours(tours);          // writes content/tours.json + regenerates tours-data.js
    console.log('Wrote content/tours.json and regenerated tours-data.js');
  }
}

main();
