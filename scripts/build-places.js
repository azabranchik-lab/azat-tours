// Generate the "stops map" places[] for every tour from its itinerary titles.
// Each place = a labelled marker {name, lat, lng, dir}. No route line is drawn,
// so order does not matter — we just collect the unique set of key locations a
// tour visits and map them to verified coordinates via the gazetteer below.
//
// Usage: node scripts/build-places.js          (writes content/tours.json + regenerates)
//        node scripts/build-places.js --dry     (report only, no writes)
//
// Tours that already have places[] (e.g. the hand-tuned best-of-10-days) are left
// untouched. Minor pastures/passes with no reliable coordinates are intentionally
// skipped — we label only recognisable key sights and towns.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// canonical key locations. dir = default label side (tuned to reduce overlaps in
// the common eastern Karakol cluster). pat = case-insensitive match in titles.
const GAZ = [
  { key: 'bishkek',       name: 'Bishkek',           lat: 42.875, lng: 74.59,  dir: 'left',   pat: /Bishkek/i },
  { key: 'song-kol',      name: 'Song-Köl Lake',     lat: 41.84,  lng: 75.13,  dir: 'bottom', pat: /Song[-\s]?K[oö]l|Son-Kol/i },
  { key: 'issyk-kol',     name: 'Lake Issyk-Köl',    lat: 42.20,  lng: 77.20,  dir: 'top',    pat: /[YI]ssyk[-\s]?K[oö]l|Ysyk[-\s]?K[oö]l/i },
  { key: 'kel-suu',       name: 'Kel-Suu Lake',      lat: 40.687, lng: 76.394, dir: 'top',    pat: /Kel[-\s]?Suu|K[oö]l[-\s]?Suu/i },
  { key: 'karakol',       name: 'Karakol',           lat: 42.49,  lng: 78.394, dir: 'top',    pat: /Karakol/i },
  { key: 'altyn-arashan', name: 'Altyn-Arashan',     lat: 42.37,  lng: 78.66,  dir: 'right',  pat: /Altyn[-\s]?Arashan/i },
  { key: 'ala-kol',       name: 'Ala-Köl Lake',      lat: 42.33,  lng: 78.55,  dir: 'bottom', pat: /Ala[-\s]?K[oö]l/i },
  { key: 'skazka',        name: 'Fairy-Tale Canyon', lat: 42.136, lng: 77.438, dir: 'bottom', pat: /Fairy[-\s]?Tale|Skazka/i },
  { key: 'naryn',         name: 'Naryn',             lat: 41.43,  lng: 75.99,  dir: 'bottom', pat: /\bNaryn\b/i },
  { key: 'kochkor',       name: 'Kochkor',           lat: 42.21,  lng: 75.75,  dir: 'left',   pat: /Kochkor/i },
  { key: 'tash-rabat',    name: 'Tash Rabat',        lat: 40.82,  lng: 75.31,  dir: 'bottom', pat: /Tash[-\s]?Rabat/i },
  { key: 'talas',         name: 'Talas',             lat: 42.52,  lng: 72.24,  dir: 'top',    pat: /Talas/i },
  { key: 'besh-tash',     name: 'Besh-Tash Lake',    lat: 41.98,  lng: 72.15,  dir: 'bottom', pat: /Besh[-\s]?Tash/i },
  { key: 'bokonbaev',     name: 'Bokonbayevo',       lat: 42.12,  lng: 76.99,  dir: 'bottom', pat: /Bokonbaev/i },
  { key: 'cholpon-ata',   name: 'Cholpon-Ata',       lat: 42.65,  lng: 77.08,  dir: 'top',    pat: /Cholpon[-\s]?Ata/i },
  { key: 'chong-kemin',   name: 'Chong-Kemin',       lat: 42.75,  lng: 76.00,  dir: 'top',    pat: /Chong[-\s]?Kemin/i },
  { key: 'kol-ukok',      name: 'Köl-Ükök Lake',     lat: 42.07,  lng: 75.99,  dir: 'right',  pat: /K[oö]l[-\s]?Ukok|Kol[-\s]?Ükök/i },
  { key: 'jeti-oguz',     name: 'Jeti-Ögüz',         lat: 42.34,  lng: 78.23,  dir: 'bottom', pat: /Je[ti]+[-\s]?[OÖ]g[uü]z|Jety[-\s]?Oguz/i },
  { key: 'kyzart',        name: 'Kyzart',            lat: 41.878, lng: 75.18,  dir: 'left',   pat: /Kyzart/i },
  { key: 'tash-bashat',   name: 'Tash-Bashat',       lat: 41.466, lng: 76.395, dir: 'right',  pat: /Tash[-\s]?Bashat/i },
  { key: 'ak-suu',        name: 'Ak-Suu',            lat: 42.46,  lng: 78.53,  dir: 'left',   pat: /Ak[-\s]?Suu|Ak[-\s]?Su\b/i },
  { key: 'kyzyl-oi',      name: 'Kyzyl-Oi',          lat: 41.87,  lng: 74.34,  dir: 'top',    pat: /Kyzyl[-\s]?Oi/i },
  { key: 'ming-kush',     name: 'Ming-Kush',         lat: 41.66,  lng: 74.55,  dir: 'left',   pat: /Ming[-\s]?Kush/i },
  { key: 'kok-kiya',      name: 'Kok-Kiya Valley',   lat: 40.55,  lng: 76.30,  dir: 'right',  pat: /Kok[-\s]?Kiya/i },
  { key: 'osh',           name: 'Osh',               lat: 40.53,  lng: 72.79,  dir: 'bottom', pat: /\bOsh\b/i },
];

const dry = process.argv.includes('--dry');
const p = path.join(ROOT, 'content', 'tours.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

// hand-tuned tours to preserve (do not overwrite their places on re-runs)
const MANUAL = new Set(['best-of-kyrgyzstan-10-days']);

let changed = 0; const low = []; const skipped = [];
for (const t of data) {
  if (MANUAL.has(t.slug)) { skipped.push(t.slug + ' (hand-tuned, preserved)'); continue; }
  const text = (t.itinerary || []).map(d => d.title || '').join(' \n ');
  const seen = new Set();
  const places = [];
  for (const g of GAZ) {
    if (g.pat.test(text) && !seen.has(g.key)) {
      seen.add(g.key);
      places.push({ name: g.name, lat: g.lat, lng: g.lng, dir: g.dir });
    }
  }
  // make sure the start city is on the map even if titles don't name it
  const startCity = GAZ.find(g => g.pat.test(t.start_from || ''));
  if (startCity && !seen.has(startCity.key)) {
    places.unshift({ name: startCity.name, lat: startCity.lat, lng: startCity.lng, dir: startCity.dir });
    seen.add(startCity.key);
  }
  if (places.length < 2) { low.push(`${t.slug} (${places.length}: ${places.map(x => x.name).join(', ') || '—'})`); }
  t.places = places;
  changed++;
}

console.log(`Generated places for ${changed} tours; ${skipped.length} skipped.`);
if (low.length) { console.log(`\n⚠ ${low.length} tours matched <2 key places (review/enrich manually):`); low.forEach(s => console.log('   ' + s)); }
console.log('\nSkipped:', skipped.join('; ') || 'none');

if (!dry) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  require('../lib/content').regenerateDataFile();
  console.log('\nWrote content/tours.json and regenerated tours-data.js');
} else {
  console.log('\n(dry run — no files written)');
}
