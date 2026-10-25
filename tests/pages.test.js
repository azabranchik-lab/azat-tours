// What the pages must contain (rules set in the SEO programme, 2026-10-25), checked on every
// tour and the catalog with the real content. Skipped where content/ is absent (CI).
const test = require('node:test');
const assert = require('node:assert');
const pages = require('../lib/pages');
const content = require('../lib/content');
const { check } = require('../scripts/check-sights');

const tours = content.publishedOnly(content.loadTours());
const skip = tours.length < 10 ? 'no local content' : false;
// visible HTML only: JSON-LD, meta tags and the <head> repeat texts on purpose
const visible = html => html.split('</head>')[1].replace(/<script[\s\S]*?<\/script>/g, '');
const count = (hay, needle) => hay.split(needle).length - 1;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('tour pages: every highlight and the summary appear once; pack and before-you-go lists are short', { skip }, () => {
  for (const t of tours) {
    const html = visible(pages.tourPage(t.slug));
    for (const h of (t.highlights || []).slice(0, 4)) assert.strictEqual(count(html, '<b>' + h + '</b>'), 1, t.slug + ': highlight once: ' + h);
    if (t.summary) assert.strictEqual(count(html, t.summary), 1, t.slug + ': summary once (hero)');
    const pack = html.match(/data-panel="pack"[\s\S]*?<ul class="book-perks">([\s\S]*?)<\/ul>/)[1];
    const before = html.match(/data-panel="before"[\s\S]*?<ul class="tour-notes">([\s\S]*?)<\/ul>/)[1];
    const items = s => (s.match(/<li>/g) || []).length;
    assert.ok(items(pack) >= 3 && items(pack) <= 5, t.slug + ': 3-5 packing points, got ' + items(pack));
    assert.ok(items(before) >= 3 && items(before) <= 5, t.slug + ': 3-5 before-you-go points, got ' + items(before));
    assert.match(html, /Full packing list and arrival tips: <a href="\/blog\/easy-from-abroad\/">/, t.slug + ': link to the full guide');
    assert.strictEqual(count(html, 'href="/blog/easy-from-abroad/"'), 1, t.slug + ': the arrival guide is linked once');
    assert.strictEqual(count(html, 'Local certified English-speaking guide'), 1, t.slug + ': inclusions once');
  }
});

test('tour pages: "Also available as" only lists real length variants, each linking to a live tour', { skip }, () => {
  const live = new Set(tours.map(t => t.slug));
  for (const t of tours) {
    const row = visible(pages.tourPage(t.slug)).match(/<div class="variant-row[^"]*">([\s\S]*?)<\/div>/);
    if (!row) continue;
    for (const m of row[1].matchAll(/href="\/tours\/([a-z0-9-]+)\/"/g)) {
      assert.ok(live.has(m[1]), t.slug + ': variant link to a live tour');
      assert.notStrictEqual(m[1], t.slug, t.slug + ': not to itself');
    }
  }
});

test('every place under "Sights visited" is on the route', { skip }, () => {
  const bad = check(tours).filter(r => r.shown && !r.mentioned);
  assert.deepStrictEqual(bad.map(r => r.slug + ': ' + r.place), []);
});

test('catalog: the server-rendered filter counts match the cards; every card links to a live tour', { skip }, () => {
  const html = pages.toursIndex();
  const cards = [...html.matchAll(/<a class="tour" href="\/tours\/([a-z0-9-]+)\/" data-cats="([^"]*)"/g)];
  assert.strictEqual(cards.length, tours.length, 'one card per published tour');
  const live = new Set(tours.map(t => t.slug));
  for (const [, slug] of cards) assert.ok(live.has(slug), slug);
  const bar = html.match(/<div class="dcats" id="dCatBar">([\s\S]*?)<\/div>/)[1];
  for (const m of bar.matchAll(/data-f="([^"]+)">[^<]*<span class="chip-n">(\d+)<\/span>/g)) {
    const expected = m[1] === 'all' ? cards.length : cards.filter(c => c[2].split('|').includes(m[1])).length;
    assert.strictEqual(Number(m[2]), expected, 'count for ' + m[1]);
  }
});

test('home: featured tours and must-see cards link to live tours; no reviews section without reviews', { skip }, () => {
  const html = visible(pages.staticPage('index.html'));
  const live = new Set(tours.map(t => t.slug));
  const links = [...html.matchAll(/href="\/tours\/([a-z0-9-]+)\/"/g)].map(m => m[1]);
  assert.ok(links.length >= 10, 'featured tours and must-see cards are links to tours');
  for (const s of links) assert.ok(live.has(s), 'home links to a live tour: ' + s);
  const reviews = content.publishedOnly(content.loadReviews()).filter(r => r.placement === 'home');
  if (!reviews.length) assert.ok(!/id="reviews"/.test(html), 'no empty "What guests say" block');
});

test('search titles: unique, at most 60 characters, and the H1 stays the tour name', { skip }, () => {
  const seen = new Map();
  for (const t of tours) {
    const page = pages.tourPage(t.slug);
    const title = page.match(/<title>([^<]*)<\/title>/)[1];
    assert.ok(title.replace(/&amp;/g, '&').length <= 60, t.slug + ': title <= 60: ' + title);
    assert.ok(!seen.has(title), t.slug + ': duplicate title with ' + seen.get(title));
    seen.set(title, t.slug);
    assert.ok(page.includes('>' + esc(t.name) + '</h1>') || page.includes('>' + t.name + '</h1>'), t.slug + ': H1 is the tour name');
  }
});
