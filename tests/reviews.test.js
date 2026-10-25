// lib/reviews.js: guest reviews in the HTML only when they exist; badges only for set profile links.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../lib/reviews');

const review = (o = {}) => Object.assign({ id: 1, name: 'Anna', country: 'Germany', text: 'Three days on horseback, two nights in yurts: the best part of our trip.', rating: 5, placement: 'home', date: '2026-07', tourSlug: 'song-kul-horse-trek-3-days', source: 'tripadvisor', sourceUrl: 'https://www.tripadvisor.com/x', avatar: '' }, o);
const HOME = '<!-- ============ REVIEWS ============ -->\n<section class="pad" id="reviews">\n  <div class="wrap"><div class="rev-track" id="revTrack"></div>\n  </div>\n</section>\n<section id="next"></section>';

test('home: without reviews the whole section is dropped; with reviews the cards and badges are in the HTML', () => {
  const empty = R.homePage(HOME, [], { tripadvisor: 'https://www.tripadvisor.com/p' });
  assert.ok(!/id="reviews"/.test(empty) && /id="next"/.test(empty), 'section removed, rest kept');
  const full = R.homePage(HOME, [review(), review({ id: 2, placement: 'reviews' })], { tripadvisor: 'https://www.tripadvisor.com/p', google: 'not a link' });
  assert.strictEqual((full.match(/class="review"/g) || []).length, 1, 'only reviews placed on the home page');
  assert.match(full, /Anna/);
  assert.match(full, /Germany · July 2026 · <a href="https:\/\/www\.tripadvisor\.com\/x"[^>]*>on Tripadvisor<\/a>/, 'country, date and source line');
  assert.match(full, /class="rev-badge ta"/, 'badge for the set profile');
  assert.ok(!/rev-badge go/.test(full), 'no badge for an invalid link');
  assert.ok(!/<img/.test(full), 'no avatar when there is no local photo');
});

test('tour page: section only for reviews about that tour; text is escaped; no ratings invented', () => {
  assert.strictEqual(R.tourSection([review({ placement: 'reviews', tourSlug: 'other' })], 'song-kul-horse-trek-3-days'), '');
  const s = R.tourSection([review({ placement: 'tour:song-kul-horse-trek-3-days', tourSlug: '', text: 'Loved it <3' }), review({ id: 3, rating: 4 })], 'song-kul-horse-trek-3-days');
  assert.match(s, /What guests say about this tour/);
  assert.strictEqual((s.match(/class="review"/g) || []).length, 2);
  assert.match(s, /Loved it &lt;3/);
  assert.match(s, /★★★★<\/div>/, 'four stars for a 4 rating');
  assert.match(R.card(review({ avatar: 'images/reviews/anna.jpg' })), /<img loading="lazy" src="\/images\/reviews\/anna.jpg"/, 'local photo is shown');
  assert.ok(!/<img/.test(R.card(review({ avatar: 'https://images.unsplash.com/photo' }))), 'stock photo is not');
});

test('reviews page: noindex stays until there is a review; buttons and badges follow the profiles', () => {
  const PAGE = '<meta name="robots" content="noindex" />\n<div class="badges-strip" id="revBadges"></div>\n<div class="reviews-masonry" id="reviewsMasonry"></div>\n<section class="pad" id="leave-review"><div class="btns" id="reviewButtons"></div></section>';
  const empty = R.reviewsPage(PAGE, [], {});
  assert.match(empty, /noindex/);
  assert.ok(!/id="leave-review"/.test(empty), 'no "review us" block without a profile link');
  assert.ok(!/rev-badge/.test(empty));
  const full = R.reviewsPage(PAGE, [review()], { google: 'https://g.page/azat' }, r => 'Song-Kul Horse Trek - 3 Days');
  assert.ok(!/noindex/.test(full), 'indexable once it has content');
  assert.match(full, /Review us on Google/);
  assert.match(full, /about Song-Kul Horse Trek - 3 Days/);
});

test('dates: 2026-07 and 2026-07-14 read as July 2026; free text passes through', () => {
  assert.strictEqual(R.dateText('2026-07'), 'July 2026');
  assert.strictEqual(R.dateText('2026-07-14'), 'July 2026');
  assert.strictEqual(R.dateText('last summer'), 'last summer');
  assert.strictEqual(R.dateText(''), '');
});
