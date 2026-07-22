#!/usr/bin/env node
/**
 * Rewrites kyrgyzriders.com image URLs in content/tours.json (images[]) and
 * content/sights.json (photo) to the self-hosted copies under public/img/catalog/,
 * then regenerates tours-data.js + sights-data.js. Idempotent and repeatable.
 *
 * Run AFTER download-catalog-images.js. Also run on the SERVER after deploy
 * (the images arrive via git; this rewrites the server's own content/*.json so
 * the bot's next regenerate keeps local paths instead of reverting to hotlinks).
 * A URL is only rewritten if its downloaded file actually exists, so a failed
 * download is left on the original URL.
 *
 *   node scripts/localize-catalog-images.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const content = require('../lib/content');

const CATALOG = path.join(__dirname, '..', 'public', 'img', 'catalog');
const localName = url => crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.jpg';

// url -> "img/catalog/<hash>.jpg" if the file exists locally, else null
function mapped(url) {
  if (!/kyrgyzriders\.com/.test(url)) return null;
  const name = localName(url);
  return fs.existsSync(path.join(CATALOG, name)) ? 'img/catalog/' + name : null;
}

let localized = 0, left = 0;

// ---- tours ----
const tours = content.loadTours();
tours.forEach(t => {
  if (Array.isArray(t.images)) {
    t.images = t.images.map(u => {
      const m = mapped(u);
      if (m) { localized++; return m; }
      if (/kyrgyzriders\.com/.test(u)) left++;
      return u;
    });
  }
});
content.saveTours(tours);
if (typeof content.regenerateDataFile === 'function') content.regenerateDataFile(tours);

// ---- sights ----
try {
  const sights = content.loadSights();
  Object.values(sights).forEach(s => {
    const m = s.photo && mapped(s.photo);
    if (m) { s.photo = m; localized++; }
    else if (s.photo && /kyrgyzriders\.com/.test(s.photo)) left++;
  });
  content.saveSights(sights);
} catch (e) { console.warn('sights skipped:', e.message); }

console.log(`Localized ${localized} image refs to img/catalog/. Still on kyrgyzriders: ${left}.`);
console.log('Regenerated tours-data.js + sights-data.js.');
