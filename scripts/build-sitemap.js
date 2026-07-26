// Generates sitemap.xml from content (tours + posts) plus the static pages.
// Idempotent. Run locally after content-affecting changes and on the server at deploy
// (after regenerating *-data.js), so search engines see every tour and post URL.
//
// Usage: node scripts/build-sitemap.js

const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

const DOMAIN = 'https://azattours.com';
const OUT = path.join(__dirname, '..', 'public', 'sitemap.xml');
const BUILD_DATE = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, set when the sitemap is generated

// static pages: [path, changefreq, priority]. reviews.html stays out (noindex until real
// reviews exist); builder.html stays out (app-like, not a landing page).
const STATIC = [
  ['/', 'weekly', '1.0'],
  ['/tours.html', 'weekly', '0.9'],
  ['/plan-trip.html', 'monthly', '0.8'],
  ['/blog.html', 'weekly', '0.7'],
  ['/about.html', 'monthly', '0.7'],
  ['/contact.html', 'monthly', '0.6'],
];

function url(loc, changefreq, priority, lastmod) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod || BUILD_DATE}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function main() {
  const tours = content.publishedOnly(content.loadTours()); // drafts stay out of the sitemap
  const posts = content.publishedOnly(content.loadPosts());

  const entries = [
    ...STATIC.map(([p, f, pr]) => url(DOMAIN + p, f, pr)),
    ...tours.map(t => url(`${DOMAIN}/tour.html?slug=${encodeURIComponent(t.slug)}`, 'monthly', '0.8')),
    ...posts.map(p => url(`${DOMAIN}/post.html?slug=${encodeURIComponent(p.slug)}`, 'monthly', '0.6', p.date)),
  ];

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') + '\n</urlset>\n';

  fs.writeFileSync(OUT, xml);
  console.log(`sitemap.xml: ${STATIC.length} static + ${tours.length} tours + ${posts.length} posts = ${entries.length} URLs`);
}

main();
