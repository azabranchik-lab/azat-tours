// Seed content/site.json (homepage media managed from the bot) + regenerate site-data.js.
// Idempotent-ish: keeps any existing site.json keys, only fills missing ones.
// Run: node scripts/seed-site.js
const C = require('../lib/content');

const site = C.loadSite() || {};

// Instagram "Follow the journey" grid — placeholder photos (owner replaces with REAL
// Kyrgyzstan photos via the bot: /home → Instagram → Add photo).
if (!site.instagram) {
  site.instagram = {
    url: 'https://instagram.com/azattours.kyrgyzstan',
    photos: [
      'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=400&q=70',
      'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=400&q=70',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=70',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=70',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=70',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=70',
    ],
  };
}

// Experience cards (homepage "Choose your kind of adventure") — 5 slots, owner
// replaces with REAL Kyrgyzstan photos via the bot (/home → Experience cards).
if (!site.experiences) {
  site.experiences = [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80', // Combined adventures
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=800&q=80', // Road trips
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80', // Horse treks
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80', // Off the beaten path
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80', // Winter tours
  ];
}

// Hero banner + builder teaser (homepage) — owner replaces via bot (/home).
if (!site.hero) site.hero = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2000&q=80';
if (!site.builder) {
  site.builder = [
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=500&q=70',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=500&q=70',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=500&q=70',
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=500&q=70',
  ];
}

C.saveSite(site);
console.log('Seeded site.json → site-data.js. IG:', site.instagram.photos.length, '| experiences:', (site.experiences || []).length, '| hero:', !!site.hero, '| builder:', (site.builder || []).length);
