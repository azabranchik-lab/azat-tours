// Seed content/sights.json from scripts/_sights.json (the curated gazetteer), then
// regenerate sights-data.js (window.SIGHTS). Idempotent: keeps any sights the owner
// has already edited via the bot; only fills in keys that are missing.
// Run: node scripts/seed-sights.js
const fs = require('fs');
const path = require('path');
const C = require('../lib/content');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '_sights.json'), 'utf8'));
const cur = C.loadSights();

let added = 0;
for (const key of Object.keys(seed)) {
  if (!cur[key]) { cur[key] = seed[key]; added++; }
}
C.saveSights(cur); // writes content/sights.json + sights-data.js

console.log(`Sights: ${Object.keys(cur).length} total (${added} newly seeded). Wrote content/sights.json + sights-data.js`);
