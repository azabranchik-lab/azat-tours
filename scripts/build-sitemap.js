// Writes public/sitemap.xml from content (tours + posts) plus the static pages.
// The live server builds the same sitemap on request (lib/pages.js), so it is
// always current after a bot edit; this script only refreshes the committed copy.
//
// Usage: node scripts/build-sitemap.js

const fs = require('fs');
const path = require('path');
const pages = require('../lib/pages');

const xml = pages.sitemapXml();
fs.writeFileSync(path.join(__dirname, '..', 'public', 'sitemap.xml'), xml);
const c = pages.counts();
console.log(`sitemap.xml: ${c.tours} tours + ${c.posts} posts, ${xml.split('<url>').length - 1} URLs`);
