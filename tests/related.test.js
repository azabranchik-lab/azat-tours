// "Other tours you might like" (lib/tour-page.js relatedTours) spreads links across the catalog
// and never points at a page whose canonical is another tour. Skipped without local content.
const test = require('node:test');
const assert = require('node:assert');
const content = require('../lib/content');
const { relatedTours, tourMeta, tourTitle } = require('../lib/tour-page');

const tours = content.publishedOnly(content.loadTours());
const skip = tours.length < 10 ? 'no local content' : false;

test('related tours: three per page, no self, no canonical-elsewhere pages, most tours get a link', { skip }, () => {
  const inbound = new Map();
  for (const t of tours) {
    const rel = relatedTours(t, tours);
    assert.strictEqual(rel.length, 3, t.slug + ': three related tours');
    for (const r of rel) {
      assert.notStrictEqual(r.slug, t.slug, t.slug + ': not itself');
      assert.ok(!(r.canonical && r.canonical !== r.slug), t.slug + ': skips ' + r.slug + ' (canonical elsewhere)');
      inbound.set(r.slug, (inbound.get(r.slug) || 0) + 1);
    }
  }
  const linkable = tours.filter(t => !(t.canonical && t.canonical !== t.slug)).length;
  assert.ok(inbound.size >= linkable * 0.75, `at least 75% of tours receive a related link (got ${inbound.size} of ${linkable})`);
  assert.ok(Math.max(...inbound.values()) <= 12, 'no tour hoards the links (max ' + Math.max(...inbound.values()) + ')');
});

test('related tours prefer trips through the same places', () => {
  const p = (...names) => names.map(name => ({ name }));
  const t = { slug: 'a', name: 'A - 3 Days', days: 3, cats: ['Horse riding'], tags: ['horseback'], places: p('Song-Kul Lake', 'Kyzart') };
  const pool = [
    t,
    { slug: 'far', name: 'Far - 3 Days', days: 3, cats: ['Horse riding'], tags: ['horseback'], places: p('Karakol') },
    { slug: 'near', name: 'Near - 2 Days', days: 2, cats: ['Road trip'], tags: [], places: p('Song-Kol Lake', 'Kyzart') },
    { slug: 'canon', name: 'Canon - 3 Days', days: 3, cats: ['Horse riding'], tags: ['horseback'], places: p('Song-Kul Lake', 'Kyzart'), canonical: 'near' },
  ];
  const rel = relatedTours(t, pool).map(x => x.slug);
  assert.strictEqual(rel[0], 'near', 'shared places win (Song-Kol and Song-Kul are the same lake)');
  assert.ok(!rel.includes('canon'), 'canonical-elsewhere page skipped');
});

test('search title: seoTitle when set, the name otherwise; the H1 keeps the name', () => {
  const base = { slug: 's', name: 'Kok-Kiya & Kel-Suu Road Trip - 8 Days', summary: 'x', itinerary: [], images: [] };
  assert.strictEqual(tourMeta(base).title, tourTitle(base.name));
  const withSeo = Object.assign({}, base, { seoTitle: 'Kyrgyzstan Road Trip 8 Days: Song-Kul, Kel-Suu & Hot Springs' });
  assert.strictEqual(tourMeta(withSeo).title, 'Kyrgyzstan Road Trip 8 Days: Song-Kul, Kel-Suu & Hot Springs');
  assert.ok(tourMeta(withSeo).title.length <= 60);
});
