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
  const posts = [{ id: 1, slug: 'p', title: 'P', body: 'Ride [Song-Kul](tour.html?slug=song-kol-lake-on-horseback-3-days) and read [this](post.html?slug=yurt-culture-etiquette), then [plan](plan-trip.html#packing) or [build](builder.html). [Away](https://example.com/x)', status: 'published' }];
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
  assert.match(out, /migrations: 4 applied/);
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
  assert.deepStrictEqual(read(root, '.migrations.json').slice(-4), ['2026-10-25-sights-fix', '2026-10-25-post-links', '2026-10-25-seo-titles', '2026-10-25-guide-2027']);
});

test('the 2027 guide arrives as a draft with its own id, and an existing post with that address is left alone', () => {
  const root = fixture();
  run(root);
  const guide = read(root, 'posts.json').find(p => p.slug === 'kyrgyzstan-travel-guide-2027');
  assert.strictEqual(guide.status, 'draft', 'not public until the owner publishes it in the bot');
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
  assert.strictEqual(kept.length, 1);
  assert.strictEqual(kept[0].title, 'Edited in the bot');
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
