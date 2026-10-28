// scripts/migrate.js on a throwaway content folder (AZAT_ROOT): the 2026-10-25 migrations fix
// what they should, keep what the owner changed in the bot, snapshot first, and run only once.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const MIGRATE = path.join(__dirname, '..', 'scripts', 'migrate.js');
const DONE_BEFORE = ['2026-10-13-rename-tours', '2026-10-13-summaries', '2026-10-13-blurb-fixes', '2026-10-14-lake-spelling',
  '2026-10-14-canonical-pairs', '2026-10-15-highlights', '2026-10-15-ala-kul-guide', '2026-10-16-new-tours'];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'azat-migrate-'));
  fs.mkdirSync(path.join(root, 'content'));
  fs.mkdirSync(path.join(root, 'public'));
  const day = n => ({ day: n, title: 'Day ' + n, desc: ['x'] });
  const tours = [
    { id: 1, slug: 'song-kul-horse-trek-3-days', name: 'Song-Kul Horse Trek - 3 Days', places: [{ name: 'Song-Kul Lake' }, { name: 'Lake Issyk-Kul' }, { name: 'Kyzart' }], itinerary: [day(1)], status: 'published' },
    { id: 2, slug: 'kok-kiya-kel-suu-road-trip-8-days', name: 'Kok-Kiya & Kel-Suu Road Trip - 8 Days', seoTitle: 'Set by the owner in the bot', places: [], itinerary: [day(1)], status: 'published' },
    { id: 3, slug: 'a-tour-nobody-renamed', name: 'Other - 2 Days', places: [], itinerary: [day(1)], status: 'published' },
  ];
  const posts = [
    { id: 2, slug: 'best-time-to-visit-kyrgyzstan', title: 'B', body: 'Intro.\n\n## Winter\n\nYou can ski and ride horses to a frozen Song-Kul.\n\n- Best for: skiing\n\n## Match the season to a trip\nThe road trip runs from April right into November.', status: 'published' },
    { id: 3, slug: 'easy-from-abroad', title: 'E', body: 'Intro.\n\n## Everything in between\n\nGuessing which marshrutka goes. That is our job.\n\n## Timing your trip\n\nJune to September.', status: 'published' },
    { id: 1, slug: 'p', title: 'P', body: 'Ride [Song-Kul](tour.html?slug=song-kol-lake-on-horseback-3-days) and read [this](post.html?slug=yurt-culture-etiquette), then [plan](plan-trip.html#packing) or [build](builder.html). [Away](https://example.com/x)', status: 'published' }];
  fs.writeFileSync(path.join(root, 'content', 'tours.json'), JSON.stringify(tours));
  fs.writeFileSync(path.join(root, 'content', 'posts.json'), JSON.stringify(posts));
  fs.writeFileSync(path.join(root, 'content', '.migrations.json'), JSON.stringify(DONE_BEFORE));
  return root;
}
const run = root => execFileSync(process.execPath, [MIGRATE], { env: Object.assign({}, process.env, { AZAT_ROOT: root }), encoding: 'utf8' });
const read = (root, f) => JSON.parse(fs.readFileSync(path.join(root, 'content', f), 'utf8'));

test('pending migrations: stale sight removed, post links canonical, search titles set but the owner\'s kept', () => {
  const root = fixture();
  const out = run(root);
  assert.match(out, /migrations: 7 applied/);
  const tours = read(root, 'tours.json'), posts = read(root, 'posts.json');
  assert.deepStrictEqual(tours[0].places.map(p => p.name), ['Song-Kul Lake', 'Kyzart'], 'Issyk-Kul removed from the 3-day ride');
  assert.strictEqual(tours[0].seoTitle, 'Song-Kul Horse Trek 3 Days: the Classic Ride from Kyzart');
  assert.strictEqual(tours[1].seoTitle, 'Set by the owner in the bot', 'a title set in the bot is not overwritten');
  assert.ok(!tours[2].seoTitle, 'a tour without a proposed title stays without one');
  const body = posts.find(p => p.slug === 'p').body;
  assert.match(body, /\]\(\/tours\/song-kul-horse-trek-3-days\/\)/, 'old tour link -> current tour address (via the redirect map)');
  assert.match(body, /\]\(\/blog\/yurt-culture-etiquette\/\)/);
  assert.match(body, /\]\(\/plan-trip\.html#packing\)/);
  assert.match(body, /\]\(\/builder\.html\)/);
  assert.match(body, /\]\(https:\/\/example\.com\/x\)/, 'external links untouched');
  assert.ok(fs.existsSync(path.join(root, 'content', 'before-2026-10-25-sights-fix', 'tours.json')), 'snapshot taken before the batch');
  assert.deepStrictEqual(read(root, '.migrations.json').slice(-7), ['2026-10-25-sights-fix', '2026-10-25-post-links', '2026-10-25-seo-titles', '2026-10-25-guide-2027', '2026-10-25-guide-2027-publish', '2026-10-27-solo-itinerary', '2026-10-28-winter-guide']);
});

test('the 2027 guide is added once with its own id, then published with the text of its source file', () => {
  const src = require('../scripts/migrations/post-kyrgyzstan-guide-2027.js');
  const root = fixture();
  run(root);
  const all = read(root, 'posts.json');
  assert.strictEqual(all.filter(p => p.slug === src.slug).length, 1);
  const guide = all.find(p => p.slug === src.slug);
  assert.strictEqual(guide.status, 'published', 'published on the owner\'s word');
  assert.strictEqual(guide.body, src.body);
  assert.ok(guide.id > 1, 'a new id');
  assert.ok(guide.seoTitle && guide.seoTitle.length <= 60);
  assert.strictEqual(guide.faq.length, 8);
  assert.ok(!/[—–]/.test(guide.body + guide.title + guide.excerpt + guide.description), 'no long dashes');

  const root2 = fixture();
  const posts = read(root2, 'posts.json');
  posts.push({ id: 9, slug: 'kyrgyzstan-travel-guide-2027', title: 'Edited in the bot', body: 'x', status: 'published' });
  fs.writeFileSync(path.join(root2, 'content', 'posts.json'), JSON.stringify(posts));
  run(root2);
  const kept = read(root2, 'posts.json').filter(p => p.slug === 'kyrgyzstan-travel-guide-2027');
  assert.strictEqual(kept.length, 1, 'no second copy');
  assert.strictEqual(kept[0].id, 9, 'the existing post keeps its id');
  assert.strictEqual(kept[0].title, src.title, 'the source file is the post\'s text from now on');
});

test('a second deploy changes nothing', () => {
  const root = fixture();
  run(root);
  const before = fs.readFileSync(path.join(root, 'content', 'tours.json'), 'utf8');
  assert.match(run(root), /nothing pending/);
  assert.strictEqual(fs.readFileSync(path.join(root, 'content', 'tours.json'), 'utf8'), before);
});

test('an empty or missing content folder stops the deploy instead of publishing an empty site', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'azat-migrate-empty-'));
  fs.mkdirSync(path.join(root, 'content'));
  assert.throws(() => run(root), /missing or empty|Command failed/);
});

test('the solo itinerary (2026-10-27) is added and published from its source file; three older posts link to it once', () => {
  const src = require('../scripts/migrations/post-kyrgyzstan-itinerary-solo-travel.js');
  const guide = require('../scripts/migrations/post-kyrgyzstan-guide-2027.js');
  const root = fixture();
  run(root);
  const all = read(root, 'posts.json');
  const post = all.find(p => p.slug === src.slug);
  assert.ok(post, 'post added');
  assert.strictEqual(all.filter(p => p.slug === src.slug).length, 1);
  assert.strictEqual(post.status, 'published');
  assert.strictEqual(post.body, src.body);
  assert.strictEqual(post.faq.length, 7);
  assert.ok(!/[—–]/.test(post.body + post.title + post.excerpt + post.description + post.faq.map(f => f.q + f.a).join('')), 'no long dashes');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', src.cover)), 'cover photo exists');
  for (const m of src.body.matchAll(/\[img:([^|\]]+)/g)) assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', m[1])), 'photo exists: ' + m[1]);
  assert.match(src.body, /\[tip#need-a-contact:/, 'the contact callout is a link target');
  assert.ok(!src.body.includes('{{WHATSAPP') && !src.body.includes('{{EMAIL}}'), 'draft placeholders replaced');
  const link = '/blog/' + src.slug + '/';
  const best = all.find(p => p.slug === 'best-time-to-visit-kyrgyzstan').body;
  assert.match(best, /into November\.\n\nTravelling on your own\? Our \[solo Kyrgyzstan itinerary\]\(\/blog\/kyrgyzstan-itinerary-solo-travel\/\)/, 'sentence after the anchor paragraph, at the end');
  const easy = all.find(p => p.slug === 'easy-from-abroad').body;
  assert.match(easy, /That is our job\.\n\nPrefer to do it yourself\? [^\n]+\n\n## Timing your trip/, 'sentence after the anchor paragraph, before the next heading');
  assert.strictEqual((best + easy).split(link).length - 1, 2, 'one link per post');
  assert.ok(guide.body.includes(link), 'the 2027 guide source links to it');

  // run again from a state where the older posts already link (an edit in the bot): nothing doubled
  const root2 = fixture();
  const posts = read(root2, 'posts.json');
  posts.find(p => p.slug === 'easy-from-abroad').body = 'See [this](' + link + ').';
  fs.writeFileSync(path.join(root2, 'content', 'posts.json'), JSON.stringify(posts));
  run(root2);
  assert.strictEqual(read(root2, 'posts.json').find(p => p.slug === 'easy-from-abroad').body, 'See [this](' + link + ').');
});

test('the winter guide (2026-10-28) is added and published from its source file; the season post and the solo itinerary link to it', () => {
  const src = require('../scripts/migrations/post-kyrgyzstan-in-winter.js');
  const solo = require('../scripts/migrations/post-kyrgyzstan-itinerary-solo-travel.js');
  const root = fixture();
  run(root);
  const all = read(root, 'posts.json');
  const post = all.find(p => p.slug === src.slug);
  assert.ok(post, 'post added');
  assert.strictEqual(all.filter(p => p.slug === src.slug).length, 1);
  assert.strictEqual(post.status, 'published');
  assert.strictEqual(post.body, src.body);
  assert.strictEqual(post.faq.length, 7);
  assert.ok(!/[—–]/.test(post.body + post.title + post.seoTitle + post.excerpt + post.description + post.faq.map(f => f.q + f.a).join('')), 'no long dashes');
  assert.ok(!/\]\(https?:\/\/(?!wa\.me\/)/.test(post.body), 'no external links in the winter guide apart from WhatsApp (owner rule)');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', src.cover)), 'cover photo exists');
  for (const m of src.body.matchAll(/\[img:([^|\]]+)/g)) assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', m[1])), 'photo exists: ' + m[1]);
  const photos = [src.cover, ...[...src.body.matchAll(/\[img:([^|\]]+)/g)].map(m => m[1])];
  assert.strictEqual(new Set(photos).size, photos.length, 'no photo twice');
  assert.match(src.body, /\[tip#need-a-contact:/);
  const link = '/blog/' + src.slug + '/';
  const best = all.find(p => p.slug === 'best-time-to-visit-kyrgyzstan').body;
  assert.match(best, /frozen Song-Kul\.\n\nOur \[Kyrgyzstan in winter guide\]\(\/blog\/kyrgyzstan-in-winter\/\)[^\n]+\n\n- Best for: skiing/, 'sentence after the winter paragraph, before its list');
  assert.strictEqual(best.split(link).length - 1, 1);
  assert.ok(solo.body.includes(link), 'the solo itinerary source links to it');
  assert.strictEqual(all.find(p => p.slug === solo.slug).body, solo.body, 'the solo itinerary on the server is synced to its source');
});
