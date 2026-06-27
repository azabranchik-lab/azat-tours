// One-off cleaner: remove the " (asphalt X / dirt Y)" suffix from every day's
// `transfer` field — both in the merge source (scripts/_itin/*.json) and in the
// live data (content/tours.json → regenerates tours-data.js).
//
// Idempotent. Run: node scripts/strip-transfer-detail.js [--dry]

const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

const ITIN_DIR = path.join(__dirname, '_itin');
const DRY = process.argv.includes('--dry');
const RE = /\s*\(asphalt\s+\d+\s*\/\s*dirt\s+\d+\)\s*$/i;
const strip = s => (typeof s === 'string' ? s.replace(RE, '').trim() : s);

let itinTouched = 0, itinDays = 0;

// Pass A — clean the _itin source files so the suffix never returns on re-merge.
if (fs.existsSync(ITIN_DIR)) {
  for (const file of fs.readdirSync(ITIN_DIR).filter(f => f.endsWith('.json'))) {
    const p = path.join(ITIN_DIR, file);
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const days = Array.isArray(raw) ? raw : raw.itinerary;
    if (!Array.isArray(days)) continue;
    let changed = 0;
    for (const d of days) {
      if (d && RE.test(d.transfer || '')) { d.transfer = strip(d.transfer); changed++; }
    }
    if (changed) {
      itinTouched++; itinDays += changed;
      if (!DRY) fs.writeFileSync(p, JSON.stringify(raw, null, 2) + '\n');
    }
  }
}

// Pass B — clean content/tours.json (the only path that fixes tours without an
// _itin file, e.g. best-of-kyrgyzstan-10-days) and regenerate tours-data.js.
const tours = content.loadTours();
let tourDays = 0, toursTouched = 0;
for (const t of tours) {
  let changed = 0;
  for (const d of (t.itinerary || [])) {
    if (d && RE.test(d.transfer || '')) { d.transfer = strip(d.transfer); changed++; }
  }
  if (changed) { toursTouched++; tourDays += changed; }
}

console.log(`_itin: ${itinDays} transfers cleaned across ${itinTouched} files`);
console.log(`tours.json: ${tourDays} transfers cleaned across ${toursTouched} tours`);

if (!DRY && tourDays) {
  content.saveTours(tours); // writes content/tours.json + regenerates tours-data.js
  console.log('Wrote content/tours.json and regenerated tours-data.js');
}
if (DRY) console.log('(dry run — nothing written)');
