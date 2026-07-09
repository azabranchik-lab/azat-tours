// Appends a closing "related tours" section with contextual internal links to each blog post,
// then rebuilds posts-data.js. SEO: every post should link to 2-3 relevant tours.
//
// Source: scripts/_post-links.json — { "<post slug>": "markdown block", ... }
// Idempotent: posts whose body already contains a tour link are skipped, so re-running
// (or running on the server after deploy) never duplicates the section.
//
// Usage: node scripts/merge-post-links.js [--dry]

const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

const SRC = path.join(__dirname, '_post-links.json');
const DRY = process.argv.includes('--dry');

function main() {
  if (!fs.existsSync(SRC)) { console.error('No _post-links.json at', SRC); process.exit(1); }
  const links = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  const posts = content.loadPosts();
  const bySlug = Object.fromEntries(posts.map(p => [p.slug, p]));

  // sanity: every referenced tour slug must exist
  const tourSlugs = new Set(content.loadTours().map(t => t.slug));
  const badRefs = [];
  for (const [slug, block] of Object.entries(links)) {
    for (const m of String(block).matchAll(/tour\.html\?slug=([a-z0-9-]+)/g)) {
      if (!tourSlugs.has(m[1])) badRefs.push(`${slug} -> ${m[1]}`);
    }
  }
  if (badRefs.length) { console.error('BROKEN TOUR REFS:\n' + badRefs.join('\n')); process.exit(1); }

  let applied = 0; const report = []; const missing = [];
  for (const [slug, block] of Object.entries(links)) {
    const post = bySlug[slug];
    if (!post) { missing.push(slug); continue; }
    if (String(post.body).includes('tour.html?slug=')) { report.push(`${slug}: SKIP (already linked)`); continue; }
    post.body = String(post.body).replace(/\s+$/, '') + '\n\n' + String(block).trim();
    report.push(`${slug}: +section (${(String(block).match(/\]\(/g) || []).length} links)`);
    applied++;
  }

  console.log(report.sort().join('\n'));
  if (missing.length) console.log('\nNO MATCHING POST for:', missing.join(', '));
  console.log(`\n${applied} posts updated${DRY ? ' (dry run — nothing written)' : ''}.`);

  if (!DRY && applied) {
    content.savePosts(posts);          // writes content/posts.json + regenerates posts-data.js
    console.log('Wrote content/posts.json and regenerated posts-data.js');
  }
}

main();
