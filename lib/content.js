// Shared content layer: tours live in content/tours.json (source of truth).
// After any change we regenerate tours-data.js (window.TOURS = [...]) which the site reads.
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./fsx');

// AZAT_ROOT lets tests run against a throwaway copy instead of the real content/.
const ROOT = process.env.AZAT_ROOT ? path.resolve(process.env.AZAT_ROOT) : path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public'); // browser-served assets (data js + images) live here
const TOURS_JSON = path.join(ROOT, 'content', 'tours.json');
const TOURS_DATA_JS = path.join(PUBLIC, 'tours-data.js');
const BUILDER_DATA_JS = path.join(PUBLIC, 'builder-data.js');   // the trip builder's slim copy
const IMAGES_DIR = path.join(PUBLIC, 'images', 'tours');
const POSTS_JSON = path.join(ROOT, 'content', 'posts.json');
const POSTS_DATA_JS = path.join(PUBLIC, 'posts-data.js');
const POST_IMAGES_DIR = path.join(PUBLIC, 'images', 'posts');
const REVIEWS_JSON = path.join(ROOT, 'content', 'reviews.json');
const REVIEWS_DATA_JS = path.join(PUBLIC, 'reviews-data.js');
const REVIEW_IMAGES_DIR = path.join(PUBLIC, 'images', 'reviews');
const GUIDES_JSON = path.join(ROOT, 'content', 'guides.json');
const GUIDES_DATA_JS = path.join(PUBLIC, 'guides-data.js');
const GUIDE_IMAGES_DIR = path.join(PUBLIC, 'images', 'guides');
const SITE_JSON = path.join(ROOT, 'content', 'site.json');
const SITE_DATA_JS = path.join(PUBLIC, 'site-data.js');
const SITE_IMAGES_DIR = path.join(PUBLIC, 'images', 'site');
const SIGHTS_JSON = path.join(ROOT, 'content', 'sights.json');
const SIGHTS_DATA_JS = path.join(PUBLIC, 'sights-data.js');
const SIGHTS_IMAGES_DIR = path.join(PUBLIC, 'images', 'sights');
const CARS_JSON = path.join(ROOT, 'content', 'cars.json');
const CAR_IMAGES_DIR = path.join(PUBLIC, 'images', 'cars');

function ensureDirs() {
  fs.mkdirSync(path.dirname(TOURS_JSON), { recursive: true });
  [IMAGES_DIR, POST_IMAGES_DIR, REVIEW_IMAGES_DIR, GUIDE_IMAGES_DIR, SITE_IMAGES_DIR, SIGHTS_IMAGES_DIR, CAR_IMAGES_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function loadTours() {
  try { return JSON.parse(fs.readFileSync(TOURS_JSON, 'utf8')); }
  catch (e) { return []; }
}

// Stamp updatedAt (YYYY-MM-DD) on every item that differs from what is on disk,
// so the sitemap's <lastmod> and dateModified reflect real edits, not build time.
function stampUpdated(list, prev) {
  const today = new Date().toISOString().slice(0, 10);
  const bare = x => JSON.stringify(Object.assign({}, x, { updatedAt: undefined }));
  const old = new Map((prev || []).filter(Boolean).map(x => [x.id, bare(x)]));
  (list || []).forEach(x => { if (x && old.get(x.id) !== bare(x)) x.updatedAt = today; });
}

function saveTours(tours) {
  ensureDirs();
  stampUpdated(tours, loadTours());
  writeFileAtomic(TOURS_JSON, JSON.stringify(tours, null, 2));
  regenerateDataFile(tours);
}

// Drafts never reach the browser: the public *-data.js files carry published
// items only. Missing status counts as published (back-compat with old content).
// 'hidden' = retired from the site but kept in content (old URL redirects elsewhere).
function publishedOnly(list) { return (list || []).filter(x => x && x.status !== 'draft' && x.status !== 'hidden'); }

// Rebuild the file the website actually loads.
// `url` (where a tour was first imported from) and `importKey` (which migration added it, e.g.
// "pack2-07") are internal bookkeeping and stay out of the public file.
function regenerateDataFile(tours) {
  const list = publishedOnly(tours || loadTours()).map(({ url, importKey, ...t }) => t);
  writeFileAtomic(TOURS_DATA_JS, 'window.TOURS = ' + JSON.stringify(list) + ';\n');
  // The trip builder (/builder.html) only matches and shows tours by these fields (tags: winter
  // season for the winter-first rule); the full file
  // carries every itinerary (540 KB with 80 tours), the slim one about 25 KB.
  const slim = list.map(t => ({ name: t.name, slug: t.slug, cats: t.cats || [], days: t.days, duration: t.duration,
    activities: t.activities || '', tour_speed: t.tour_speed || '', accommodations: t.accommodations || '', tags: t.tags || [], images: (t.images || []).slice(0, 1) }));
  writeFileAtomic(BUILDER_DATA_JS, 'window.TOURS = ' + JSON.stringify(slim) + ';\n');
  return list.length;
}

function slugify(name) {
  return String(name).toLowerCase()
    .replace(/[öó]/g, 'o').replace(/[üú]/g, 'u').replace(/[áä]/g, 'a').replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tour';
}

function uniqueSlug(name, tours, ignoreId) {
  let base = slugify(name), slug = base, n = 2;
  while (tours.some(t => t.slug === slug && t.id !== ignoreId)) slug = base + '-' + n++;
  return slug;
}

function nextId(tours) {
  return (tours.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) || 10000) + 1;
}

// A blank tour with all fields the site expects, so rendering never breaks.
function blankTour() {
  return {
    id: 0, name: '', slug: '', url: '', cats: [], category: '',
    duration: '', days: 0, season: '', start_from: 'Bishkek', tour_speed: '',
    accommodations: '', activities: '', total_drive: '', summary: '',
    highlights: [], itinerary: [], images: [], tags: [], places: [], blurb: null,
    priceFrom: 0, priceNote: '',   // USD per person shown as "from $X" (0 = on request) and what that price assumes
    status: 'published'
  };
}

// ---------- BLOG POSTS ----------
function loadPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8')); }
  catch (e) { return []; }
}
function savePosts(posts) {
  ensureDirs();
  stampUpdated(posts, loadPosts());
  writeFileAtomic(POSTS_JSON, JSON.stringify(posts, null, 2));
  regeneratePostsFile(posts);
}
function regeneratePostsFile(posts) {
  const list = publishedOnly(posts || loadPosts());
  writeFileAtomic(POSTS_DATA_JS, 'window.POSTS = ' + JSON.stringify(list) + ';\n');
  return list.length;
}
function uniquePostSlug(title, posts, ignoreId) {
  let base = slugify(title), slug = base, n = 2;
  while (posts.some(p => p.slug === slug && p.id !== ignoreId)) slug = base + '-' + n++;
  return slug;
}
function nextPostId(posts) {
  return (posts.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) || 1000) + 1;
}
// rough read time from body length
function readTime(body) {
  const words = String(body).trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}
function blankPost() {
  return {
    id: 0, slug: '', title: '', category: 'Travel guide', excerpt: '',
    author: 'Azat Tours team', authorImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
    date: '', cover: '', body: '', images: [], status: 'published'
  };
}

// ---------- REVIEWS ----------
function loadReviews() { try { return JSON.parse(fs.readFileSync(REVIEWS_JSON, 'utf8')); } catch (e) { return []; } }
function saveReviews(list) { ensureDirs(); writeFileAtomic(REVIEWS_JSON, JSON.stringify(list, null, 2)); regenerateReviews(list); }
function regenerateReviews(list) { const l = list || loadReviews(); writeFileAtomic(REVIEWS_DATA_JS, 'window.REVIEWS = ' + JSON.stringify(l) + ';\n'); return l.length; }
function nextReviewId(list) { return (list.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) || 5000) + 1; }
function blankReview() {
  // date: 2026-07 or 2026-07-14; tourSlug: which tour it is about; source: tripadvisor | google | getyourguide | direct
  return { id: 0, name: '', country: '', text: '', rating: 5, avatar: '', placement: 'home', date: '', tourSlug: '', source: 'direct', sourceUrl: '' };
}

// ---------- GUIDES ----------
function loadGuides() { try { return JSON.parse(fs.readFileSync(GUIDES_JSON, 'utf8')); } catch (e) { return []; } }
function saveGuides(list) { ensureDirs(); writeFileAtomic(GUIDES_JSON, JSON.stringify(list, null, 2)); regenerateGuides(list); }
function regenerateGuides(list) { const l = list || loadGuides(); writeFileAtomic(GUIDES_DATA_JS, 'window.GUIDES = ' + JSON.stringify(l) + ';\n'); return l.length; }
function nextGuideId(list) { return (list.reduce((m, g) => Math.max(m, Number(g.id) || 0), 0) || 0) + 1; }
function blankGuide() { return { id: 0, name: '', role: '', languages: [], bio: '', photo: '' }; }

// ---------- SITE SETTINGS ----------
function loadSite() { try { return JSON.parse(fs.readFileSync(SITE_JSON, 'utf8')); } catch (e) { return {}; } }
function saveSite(obj) { ensureDirs(); writeFileAtomic(SITE_JSON, JSON.stringify(obj, null, 2)); regenerateSite(obj); }
function regenerateSite(obj) { const o = obj || loadSite(); writeFileAtomic(SITE_DATA_JS, 'window.SITE = ' + JSON.stringify(o) + ';\n'); }

// ---------- SIGHTS (global places map: key -> {name, photo, blurb}; bot-editable) ----------
function loadSights() { try { return JSON.parse(fs.readFileSync(SIGHTS_JSON, 'utf8')); } catch (e) { return {}; } }
function saveSights(obj) { ensureDirs(); writeFileAtomic(SIGHTS_JSON, JSON.stringify(obj, null, 2)); regenerateSights(obj); }
function regenerateSights(obj) { const o = obj || loadSights(); writeFileAtomic(SIGHTS_DATA_JS, 'window.SIGHTS = ' + JSON.stringify(o) + ';\n'); }

// ---------- CARS (rental fleet; added and edited through the admin bot) ----------
// No public cars-data.js: the site renders car pages on the server (lib/pages.js),
// so the browser never downloads the whole fleet.
function loadCars() { try { return JSON.parse(fs.readFileSync(CARS_JSON, 'utf8')); } catch (e) { return []; } }
function saveCars(list) { ensureDirs(); stampUpdated(list, loadCars()); writeFileAtomic(CARS_JSON, JSON.stringify(list, null, 2)); }
function nextCarId(list) { return (list.reduce((m, c) => Math.max(m, Number(c.id) || 0), 0) || 7000) + 1; }
// Prices are USD per day; 0 = not offered. Empty optional fields are hidden on the page.
function blankCar() {
  return {
    id: 0, slug: '', name: '', make: '', model: '', year: 0,
    type: '', transmission: '', drive: '', fuel: '', seats: 0,
    priceSelf: 0, priceDriver: 0, deposit: 0, minDays: 0,
    features: [], summary: '', terms: '',
    available: true, images: [], status: 'draft'
  };
}
// "Toyota Land Cruiser Prado 2019" -> { make, model, year, name }; null without a year.
function parseCarName(text) {
  const t = String(text || '').replace(/\([^)]*\)/g, ' ').replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.*?)\s*\b((?:19|20)\d{2})\b\s*(.*)$/);
  if (!m) return null;
  const year = Number(m[2]);
  if (year > new Date().getFullYear() + 1) return null;
  // "toyota" -> "Toyota"; "RAV4" or "GX" stay as typed
  const cap = w => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  const words = (m[1] + ' ' + m[3]).trim().split(' ').filter(Boolean).map(cap);
  if (words.length < 2) return null;
  const make = words[0], model = words.slice(1).join(' ');
  return { make, model, year, name: `${make} ${model} ${year}` };
}
// What still blocks publishing (empty list = ready).
function carMissing(c) {
  const miss = [];
  if (!c.make || !c.model || !c.year) miss.push('make, model and year');
  if (!c.transmission) miss.push('gearbox');
  if (!c.drive) miss.push('drive');
  if (!c.seats) miss.push('seats');
  if (!(c.priceSelf > 0) && !(c.priceDriver > 0)) miss.push('a price');
  if (!(c.images || []).length) miss.push('at least one photo');
  return miss;
}

module.exports = {
  ROOT, PUBLIC, TOURS_JSON, TOURS_DATA_JS, IMAGES_DIR,
  POSTS_JSON, POSTS_DATA_JS, POST_IMAGES_DIR,
  REVIEWS_JSON, REVIEWS_DATA_JS, REVIEW_IMAGES_DIR,
  GUIDES_JSON, GUIDES_DATA_JS, GUIDE_IMAGES_DIR,
  SITE_JSON, SITE_DATA_JS, SITE_IMAGES_DIR,
  SIGHTS_JSON, SIGHTS_DATA_JS, SIGHTS_IMAGES_DIR,
  CARS_JSON, CAR_IMAGES_DIR,
  loadCars, saveCars, nextCarId, blankCar, parseCarName, carMissing,
  ensureDirs, loadTours, saveTours, regenerateDataFile,
  loadPosts, savePosts, regeneratePostsFile,
  loadReviews, saveReviews, regenerateReviews, nextReviewId, blankReview,
  loadGuides, saveGuides, regenerateGuides, nextGuideId, blankGuide,
  loadSite, saveSite, regenerateSite,
  loadSights, saveSights, regenerateSights,
  slugify, uniqueSlug, nextId, blankTour,
  uniquePostSlug, nextPostId, readTime, blankPost,
  publishedOnly
};
