// Merge per-tour summaries into content/tours.json, then rebuild tours-data.js.
//
// Source: scripts/migrations/summaries.json: { "<slug>": "summary text", ... }
// The summary is the paragraph under the tour's H1, the lead of the Description
// tab and the description in the TouristTrip JSON-LD. These are our own texts,
// written from each tour's itinerary (the imported ones were copied wording).
//
// Only `summary` of matching tours is set; every other field is left untouched.
// Idempotent: re-running with the same source reproduces the same result.
//
// ⚠ DEPLOY: content/tours.json is server-authoritative, so run this on the
// server after scripts/migrations/rename-tours.js (the keys are the NEW slugs).
//
// Usage: node scripts/merge-summaries.js [--dry]

const content = require('../../lib/content');
const summaries = require('./summaries.json');

const DRY = process.argv.includes('--dry');
const tours = content.loadTours();
const bySlug = Object.fromEntries(tours.map(t => [t.slug, t]));

let applied = 0; const missing = [];
for (const [slug, text] of Object.entries(summaries)) {
  const tour = bySlug[slug];
  if (!tour) { missing.push(slug); continue; }
  if (tour.summary !== text) { tour.summary = text; applied++; }
}
if (missing.length) console.log('NO MATCHING TOUR for:', missing.join(', '));
const without = content.publishedOnly(tours).filter(t => !summaries[t.slug]).map(t => t.slug);
if (without.length) console.log('Tours without a summary in the source:', without.join(', '));

if (DRY) console.log(`${applied} summaries would change (dry run, nothing written).`);
else if (applied) { content.saveTours(tours); console.log(`${applied} summaries updated; tours-data.js regenerated.`); }
else console.log('Nothing to change (already applied).');
