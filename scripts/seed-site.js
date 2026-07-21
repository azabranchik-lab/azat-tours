// Seed content/site.json (homepage media managed from the bot) + regenerate site-data.js.
// Idempotent-ish: keeps any existing site.json keys, only fills missing ones.
// Run: node scripts/seed-site.js
const C = require('../lib/content');

const site = C.loadSite() || {};

// Instagram "Follow the journey" grid — the owner's own photos, shipped in git
// under public/img/ (see scripts/build-photos.js). Paths are relative to public/,
// which is what home-media.js drops straight into src=. The bot can still replace
// them, and its uploads land in the server-owned public/images/ instead.
if (!site.instagram) {
  site.instagram = {
    url: 'https://www.instagram.com/azattourskg/',
    photos: [
      'img/ig/ig-1-riders-mist.jpg',
      'img/ig/ig-2-guide-taigan.jpg',
      'img/ig/ig-3-kalpak.jpg',
      'img/ig/ig-4-trail.jpg',
      'img/ig/ig-5-pass.jpg',
      'img/ig/ig-6-balbals.jpg',
    ],
  };
}

// Experience cards (homepage "Choose your kind of adventure") — 5 slots, owner
// replaces with REAL Kyrgyzstan photos via the bot (/home → Experience cards).
if (!site.experiences) {
  site.experiences = [
    'img/exp/combined-adventures.jpg', // Combined adventures
    'img/exp/road-trips.jpg', // Road trips
    'img/exp/horse-treks.jpg', // Horse treks
    'img/exp/off-the-beaten-path.jpg', // Off the beaten path
    'img/exp/winter-tours.jpg', // Winter tours
  ];
}

// Hero banner + builder teaser (homepage) — owner replaces via bot (/home).
// Must match the first slide in index.html: home-media.js overwrites that slide
// with this value, so a stale URL here would silently undo the hero.
if (!site.hero) site.hero = 'img/hero/hero-1-reflection-1400.jpg';
if (!site.builder) {
  site.builder = [
    'img/page/tours.jpg',
    'img/blog/tailor-made-trips.jpg',
    'img/blog/safety-in-the-mountains.jpg',
    'img/exp/horse-treks.jpg',
  ];
}

C.saveSite(site);
console.log('Seeded site.json → site-data.js. IG:', site.instagram.photos.length, '| experiences:', (site.experiences || []).length, '| hero:', !!site.hero, '| builder:', (site.builder || []).length);
