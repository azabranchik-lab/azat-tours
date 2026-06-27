// Merge per-tour card blurbs into content/tours.json, then rebuild tours-data.js.
//
// Source: scripts/_blurbs.json  — { "<slug>": { "hook": "...", "text": "..." }, ... }
// The blurb is the short card description (bold hook + 2 sentences) shown on the
// catalog (tours.html) and the homepage featured grid (index.html).
//
// Only `blurb` of matching tours is set; every other field is left untouched.
// Idempotent: re-running with the same source reproduces the same result.
//
// Usage: node scripts/merge-blurbs.js [--dry]

const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

const SRC = path.join(__dirname, '_blurbs.json');
const DRY = process.argv.includes('--dry');

function main() {
  if (!fs.existsSync(SRC)) { console.error('No _blurbs.json at', SRC); process.exit(1); }
  const blurbs = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  const tours = content.loadTours();
  const bySlug = Object.fromEntries(tours.map(t => [t.slug, t]));

  let applied = 0; const report = []; const missing = [];
  for (const [slug, b] of Object.entries(blurbs)) {
    const tour = bySlug[slug];
    if (!tour) { missing.push(slug); continue; }
    const hook = String((b && b.hook) || '').trim();
    const text = String((b && b.text) || '').trim();
    if (!text) { report.push(`${slug}: SKIP (empty text)`); continue; }
    tour.blurb = { hook, text };
    report.push(`${slug}: hook ${hook.split(/\s+/).length}w, text ${text.split(/\s+/).length}w`);
    applied++;
  }

  console.log(report.sort().join('\n'));
  if (missing.length) console.log('\nNO MATCHING TOUR for:', missing.join(', '));
  const without = tours.filter(t => !t.blurb).map(t => t.slug);
  if (without.length) console.log('\nTOURS WITHOUT BLURB:', without.join(', '));
  console.log(`\n${applied} tours updated${DRY ? ' (dry run — nothing written)' : ''}.`);

  if (!DRY && applied) {
    content.saveTours(tours);          // writes content/tours.json + regenerates tours-data.js
    console.log('Wrote content/tours.json and regenerated tours-data.js');
  }
}

main();
