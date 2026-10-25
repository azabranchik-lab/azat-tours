// Structured data on every page type parses and carries the required fields (lib/pages.js render).
// Runs against the local content/*.json; skipped when there is no content on this machine.
const test = require('node:test');
const assert = require('node:assert');
const pages = require('../lib/pages');
const content = require('../lib/content');

const tours = content.publishedOnly(content.loadTours());
const posts = content.publishedOnly(content.loadPosts());
const skip = !tours.length || !posts.length ? 'no local content' : false;

const ld = html => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => [].concat(JSON.parse(m[1])));
const byType = (nodes, t) => nodes.find(n => n['@type'] === t);

test('home: TravelAgency with contact, address and sameAs; WebSite; FAQPage', { skip }, () => {
  const nodes = ld(pages.staticPage('index.html'));
  const org = byType(nodes, 'TravelAgency');
  assert.ok(org && org.name && org.url && org.logo && org.contactPoint && org.address && org.sameAs.length, 'organisation fields');
  assert.ok(!org.aggregateRating, 'no invented rating');
  const site = byType(nodes, 'WebSite');
  assert.ok(site && site.url === 'https://azattours.com/' && site.publisher['@id'] === org['@id'], 'WebSite linked to the organisation');
  assert.ok(byType(nodes, 'FAQPage').mainEntity.length >= 3, 'home FAQ');
});

test('every tour: TouristTrip (itinerary, provider, offer only with a price), BreadcrumbList, FAQPage matches the visible questions', { skip }, () => {
  for (const t of tours) {
    const html = pages.tourPage(t.slug);
    const nodes = ld(html);
    const trip = byType(nodes, 'TouristTrip');
    assert.ok(trip, t.slug + ': TouristTrip');
    assert.ok(trip.name && trip.description && trip.image && trip.url, t.slug + ': name/description/image/url');
    assert.strictEqual(trip.itinerary.itemListElement.length, t.itinerary.length, t.slug + ': itinerary days');
    assert.strictEqual(trip.provider['@id'], 'https://azattours.com/#organization', t.slug + ': provider');
    assert.ok(!trip.aggregateRating && !trip.review, t.slug + ': no invented reviews');
    if (t.priceFrom > 0) {
      assert.strictEqual(trip.offers['@type'], 'Offer', t.slug + ': Offer');
      assert.strictEqual(trip.offers.price, t.priceFrom, t.slug + ': price');
      assert.strictEqual(trip.offers.priceSpecification.minPrice, t.priceFrom, t.slug + ': "from" price');
    } else assert.strictEqual(trip.offers, undefined, t.slug + ': no offer without a price');
    const crumbs = byType(nodes, 'BreadcrumbList').itemListElement;
    assert.deepStrictEqual(crumbs.map(c => c.name), ['Home', 'Tours', t.name], t.slug + ': breadcrumbs');
    const faq = byType(nodes, 'FAQPage');
    const visible = (html.match(/class="tfaq-q"/g) || []).length;
    assert.strictEqual(faq ? faq.mainEntity.length : 0, visible, t.slug + ': FAQ schema equals the visible questions');
    assert.match(html, /href="\/blog\/[a-z0-9-]+\/"/, t.slug + ': links to at least one article');
  }
});

test('every post: BlogPosting by a Person with a page, dates, image, publisher with logo; BreadcrumbList', { skip }, () => {
  for (const p of posts) {
    const nodes = ld(pages.postPage(p.slug));
    const post = byType(nodes, 'BlogPosting');
    assert.ok(post && post.headline && post.description && post.image && post.datePublished && post.dateModified, p.slug + ': fields');
    assert.strictEqual(post.author['@type'], 'Person', p.slug + ': author is a person');
    assert.strictEqual(post.author.url, 'https://azattours.com/about.html', p.slug + ': author page');
    assert.ok(post.publisher.logo && post.publisher.logo.url, p.slug + ': publisher logo');
    assert.deepStrictEqual(byType(nodes, 'BreadcrumbList').itemListElement.map(c => c.name), ['Home', 'Blog', p.title], p.slug + ': breadcrumbs');
  }
});

test('lists: ItemList on /tours/ and /blog/ with one entry per item; sitemap has loc+lastmod only', { skip }, () => {
  assert.strictEqual(byType(ld(pages.toursIndex()), 'ItemList').numberOfItems, tours.length);
  assert.strictEqual(byType(ld(pages.blogIndex()), 'ItemList').numberOfItems, posts.length);
  const sm = pages.sitemapXml();
  assert.ok(!/changefreq|priority/.test(sm), 'no changefreq/priority');
  assert.ok(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sm), 'lastmod dates');
  assert.strictEqual((sm.match(/<url>/g) || []).length, (sm.match(/<lastmod>/g) || []).length, 'every URL has a lastmod');
});
