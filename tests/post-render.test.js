// The blog's Markdown subset (lib/post-page.js): tables, numbered lists, italics and portrait
// photos, added for the 2027 guide (2026-10-25), plus the search-only title of a post.
const test = require('node:test');
const assert = require('node:assert');
const { mdToHtml, postMeta } = require('../lib/post-page');

test('a pipe table becomes a real table; each cell knows its column for the phone layout', () => {
  const html = mdToHtml('Intro.\n\n| Day | Route | Night |\n| --- | --- | --- |\n| 1 | Bishkek → [Ala-Archa](/tours/x/) | **Bishkek** |\n| 2 | Song-Kul | Yurt |\n\nAfter.');
  assert.match(html, /<div class="table-wrap"><table class="cols-3"><thead><tr><th scope="col">Day<\/th><th scope="col">Route<\/th><th scope="col">Night<\/th><\/tr><\/thead><tbody>/);
  assert.match(html, /<td data-label="Route">Bishkek → <a href="\/tours\/x\/">Ala-Archa<\/a><\/td>/);
  assert.match(html, /<td data-label="Night"><strong>Bishkek<\/strong><\/td>/);
  assert.strictEqual((html.match(/<tr>/g) || []).length, 3, 'header + 2 rows');
  assert.match(html, /<\/table><\/div><p>After\.<\/p>$/);
});

test('a table without a header line has no <thead> and no labels', () => {
  const html = mdToHtml('| a | b |\n| c | d |');
  assert.ok(!/<thead>|data-label/.test(html));
  assert.strictEqual((html.match(/<td>/g) || []).length, 4);
});

test('numbered lists, bullet lists and italics', () => {
  const html = mdToHtml('1. **One.** first\n2. second\n\n- a\n- b\n\nWatch *Race Across the World* and **bold** too.');
  assert.match(html, /^<ol><li><strong>One\.<\/strong> first<\/li><li>second<\/li><\/ol><ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<em>Race Across the World<\/em> and <strong>bold<\/strong>/);
  assert.ok(!/<em>/.test(mdToHtml('2 * 3 * 4 and a*b')), 'lone asterisks are not italics');
});

test('a portrait photo gets the narrow frame, a landscape one does not', () => {
  assert.match(mdToHtml('[img:img/catalog/own-a63d2b4403a0.jpg|Burana]'), /<figure class="tall">/);
  assert.match(mdToHtml('[img:img/places/kel-suu.jpg|Kel-Suu]'), /<figure><img/);
  assert.match(mdToHtml('[img:https://example.com/a.jpg|x]'), /<figure><img/);
});

test('seoTitle replaces the <title> only; the H1 and the article headline stay the title', () => {
  const p = { slug: 's', title: 'A very long headline for the article page that goes on', seoTitle: 'Short search title', body: 'x', date: '2026-10-25' };
  const meta = postMeta(p);
  assert.strictEqual(meta.title, 'Short search title | Azat Tours');
  assert.strictEqual(meta.jsonld[0].headline, p.title);
});
