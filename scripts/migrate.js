#!/usr/bin/env node
/**
 * One-time content migrations, run on every deploy (.github/workflows/deploy.yml).
 *
 * content/*.json lives on the server and is edited there through the bot, so a
 * change to existing content cannot arrive with the code: it has to be applied
 * to the server's copy. Each migration below runs exactly once per server; the
 * applied ids are remembered in content/.migrations.json. That matters because
 * some of them overwrite text (summaries), and re-running on a later deploy
 * would undo edits made in the bot since.
 *
 * To add one: append [id, steps] to MIGRATIONS. Never edit or reorder old ones.
 *
 *   node scripts/migrate.js          # apply what is pending
 *   node scripts/migrate.js --list   # show state, change nothing
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const content = require('../lib/content');

const STATE = path.join(content.ROOT, 'content', '.migrations.json');
// migration inputs live in scripts/migrations/
const run = (script, ...args) => () => execFileSync(process.execPath, [path.join(__dirname, 'migrations', script), ...args], { stdio: 'inherit' });

// Blurbs that named an old tour series; only these three, the rest stay as edited.
function fixBlurbs() {
  const src = require('./migrations/blurbs.json');
  const tours = content.loadTours();
  let n = 0;
  for (const slug of ['kyrgyzstan-grand-tour-10-days', 'song-kul-kel-suu-altyn-arashan-8-days', 'song-kul-kel-suu-in-a-week-7-days']) {
    const t = tours.find(x => x.slug === slug);
    if (t && src[slug]) { t.blurb = { hook: src[slug].hook, text: src[slug].text }; n++; }
  }
  if (n) content.saveTours(tours);
  console.log(n + ' blurb(s) updated');
}

// Near-identical length variants: both pages stay, search engines get the longer one.
function setCanonicals() {
  const pairs = {
    'tash-rabat-kel-suu-ala-kul-11-days': 'complete-kyrgyzstan-adventure-12-days',
    'tash-rabat-kel-suu-road-trip-11-days': 'grand-kyrgyzstan-road-trip-12-days',
  };
  const tours = content.loadTours();
  let n = 0;
  for (const [slug, main] of Object.entries(pairs)) {
    const t = tours.find(x => x.slug === slug);
    if (t && tours.some(x => x.slug === main) && t.canonical !== main) { t.canonical = main; n++; }
  }
  if (n) content.saveTours(tours);
  console.log(n + ' canonical(s) set');
}

// Highlights written from each tour's own itinerary (the imported ones were copied wording).
function setHighlights() {
  const src = require('./migrations/highlights.json');
  const tours = content.loadTours();
  let n = 0;
  for (const t of tours) if (Array.isArray(src[t.slug]) && JSON.stringify(t.highlights) !== JSON.stringify(src[t.slug])) { t.highlights = src[t.slug]; n++; }
  if (n) content.saveTours(tours);
  console.log(n + ' tour(s) got new highlights');
}

// Replace one post's text with a reviewed source file (scripts/migrations/post-*.js).
const setPost = file => () => {
  const src = require(file);
  const posts = content.loadPosts();
  const p = posts.find(x => x.slug === src.slug);
  if (!p) { console.log('post not found: ' + src.slug); return; }
  Object.assign(p, { title: src.title, excerpt: src.excerpt, body: src.body, faq: src.faq });
  content.savePosts(posts);
  console.log('post updated: ' + src.slug);
};

// Add a new post from a source file as a DRAFT (the owner reviews it in the bot and publishes).
// A post with the same address is left alone, so nothing edited in the bot is overwritten.
const addPost = file => () => {
  const src = require(file);
  const posts = content.loadPosts();
  if (posts.some(x => x.slug === src.slug)) { console.log('post already there: ' + src.slug); return; }
  const id = Math.max(1000, ...posts.map(x => Number(x.id) || 0)) + 1;
  const { slug, title, seoTitle, description, excerpt, category, date, cover, cover_alt, body, faq } = src;
  posts.unshift({ id, slug, title, seoTitle, description, category, excerpt, author: 'Azat, founder & guide', authorImg: '', date, cover, cover_alt, images: [], body, faq, status: 'draft', updatedAt: date });
  content.savePosts(posts);
  console.log('draft post added: ' + slug);
};

// Sights that a route never reaches (places[] was generated from old day titles): scripts/migrations/sights-fix.json.
function fixSights() {
  const fix = require('./migrations/sights-fix.json');
  const tours = content.loadTours();
  let n = 0;
  for (const [slug, names] of Object.entries(fix)) {
    if (slug.startsWith('_')) continue;
    const t = tours.find(x => x.slug === slug);
    if (!t || !Array.isArray(t.places)) continue;
    const before = t.places.length;
    t.places = t.places.filter(p => !names.includes(p.name));
    n += before - t.places.length;
  }
  if (n) content.saveTours(tours);
  console.log(n + ' stale sight(s) removed');
}

// Links inside post bodies were written as "tour.html?slug=x" / "post.html?slug=x" / "builder.html";
// the renderer rewrites them, but the data should carry the canonical addresses (/tours/x/ etc.).
function cleanPostLinks() {
  const { cleanHref } = require('../lib/post-page');
  let renames = {};
  try { renames = require('../data/tour-redirects.json').renames || {}; } catch (e) {}
  const resolve = s => { let x = s; for (let i = 0; i < 6 && renames[x]; i++) x = renames[x].hide ? renames[x].redirect : renames[x].slug; return x; };
  const posts = content.loadPosts();
  let n = 0;
  for (const p of posts) {
    const body = String(p.body || '').replace(/\]\(([^)\s]+)\)/g, (m, href) => { const c = cleanHref(href, resolve); if (c !== href) n++; return '](' + c + ')'; });
    if (body !== p.body) p.body = body;
  }
  if (n) content.savePosts(posts);
  console.log(n + ' post link(s) made canonical');
}

// Search titles (seoTitle) from scripts/migrations/tour-seo-titles.json; a title set in the bot since is kept.
function setSeoTitles() {
  const { titles } = require('./migrations/tour-seo-titles.json');
  const tours = content.loadTours();
  let n = 0;
  for (const t of tours) if (titles[t.slug] && !t.seoTitle) { t.seoTitle = titles[t.slug]; n++; }
  if (n) content.saveTours(tours);
  console.log(n + ' search title(s) set');
}

const MIGRATIONS = [
  ['2026-10-13-rename-tours', [run('rename-tours.js')]],
  ['2026-10-13-summaries', [run('merge-summaries.js')]],
  ['2026-10-13-blurb-fixes', [fixBlurbs]],
  ['2026-10-14-lake-spelling', [run('unify-spelling.js')]],
  ['2026-10-14-canonical-pairs', [setCanonicals]],
  ['2026-10-15-highlights', [setHighlights]],
  ['2026-10-15-ala-kul-guide', [setPost('./migrations/post-ala-kul.js')]],
  // The 2026 tour pack: 41 day trips and short tours (scripts/migrations/tours-2026/). Published right
  // away (owner decision 2026-10-17); he edits them in the bot. Existing tours are not touched.
  ['2026-10-16-new-tours', [() => require('./migrations/tours-2026/add-tours').addTours({ publish: true })]],
  // SEO phase 1 (2026-10-25): stale sights off two tours; canonical link addresses inside post bodies.
  ['2026-10-25-sights-fix', [fixSights]],
  ['2026-10-25-post-links', [cleanPostLinks]],
  // Phase 3 (owner delegated the decision, 2026-10-25): query-first <title> per tour, names unchanged.
  ['2026-10-25-seo-titles', [setSeoTitles]],
  // Blog pillar page from the owner's draft, added as a draft for his review in the bot.
  ['2026-10-25-guide-2027', [addPost('./migrations/post-kyrgyzstan-guide-2027.js')]],
];

function main() {
  let done = [];
  try { done = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
  const pending = MIGRATIONS.filter(([id]) => !done.includes(id));
  if (process.argv.includes('--list')) {
    MIGRATIONS.forEach(([id]) => console.log((done.includes(id) ? 'done     ' : 'pending  ') + id));
    return;
  }
  if (!pending.length) { console.log('migrations: nothing pending'); return; }
  // An unreadable content folder must stop the deploy here, not publish an empty site.
  if (!content.loadTours().length) { console.error('migrations: content/tours.json is missing or empty, aborting'); process.exit(1); }
  // Keep the content as it was before this batch (content/ is not in git).
  const snap = path.join(content.ROOT, 'content', 'before-' + pending[0][0]);
  if (!fs.existsSync(snap)) {
    fs.mkdirSync(snap, { recursive: true });
    for (const f of ['tours.json', 'posts.json', 'sights.json', 'site.json']) {
      const src = path.join(content.ROOT, 'content', f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(snap, f));
    }
    console.log('content snapshot: ' + snap);
  }
  for (const [id, steps] of pending) {
    console.log('→ migration ' + id);
    steps.forEach(step => step());
    done.push(id);
    fs.writeFileSync(STATE, JSON.stringify(done, null, 2));
  }
  console.log('migrations: ' + pending.length + ' applied');
}

main();
