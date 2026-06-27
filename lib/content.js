// Shared content layer: tours live in content/tours.json (source of truth).
// After any change we regenerate tours-data.js (window.TOURS = [...]) which the site reads.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOURS_JSON = path.join(ROOT, 'content', 'tours.json');
const TOURS_DATA_JS = path.join(ROOT, 'tours-data.js');
const IMAGES_DIR = path.join(ROOT, 'images', 'tours');
const POSTS_JSON = path.join(ROOT, 'content', 'posts.json');
const POSTS_DATA_JS = path.join(ROOT, 'posts-data.js');
const POST_IMAGES_DIR = path.join(ROOT, 'images', 'posts');
const REVIEWS_JSON = path.join(ROOT, 'content', 'reviews.json');
const REVIEWS_DATA_JS = path.join(ROOT, 'reviews-data.js');
const REVIEW_IMAGES_DIR = path.join(ROOT, 'images', 'reviews');
const GUIDES_JSON = path.join(ROOT, 'content', 'guides.json');
const GUIDES_DATA_JS = path.join(ROOT, 'guides-data.js');
const GUIDE_IMAGES_DIR = path.join(ROOT, 'images', 'guides');
const SITE_JSON = path.join(ROOT, 'content', 'site.json');
const SITE_DATA_JS = path.join(ROOT, 'site-data.js');
const SITE_IMAGES_DIR = path.join(ROOT, 'images', 'site');
const SIGHTS_JSON = path.join(ROOT, 'content', 'sights.json');
const SIGHTS_DATA_JS = path.join(ROOT, 'sights-data.js');
const SIGHTS_IMAGES_DIR = path.join(ROOT, 'images', 'sights');

function ensureDirs() {
  fs.mkdirSync(path.dirname(TOURS_JSON), { recursive: true });
  [IMAGES_DIR, POST_IMAGES_DIR, REVIEW_IMAGES_DIR, GUIDE_IMAGES_DIR, SITE_IMAGES_DIR, SIGHTS_IMAGES_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function loadTours() {
  try { return JSON.parse(fs.readFileSync(TOURS_JSON, 'utf8')); }
  catch (e) { return []; }
}

function saveTours(tours) {
  ensureDirs();
  fs.writeFileSync(TOURS_JSON, JSON.stringify(tours, null, 2));
  regenerateDataFile(tours);
}

// Rebuild the file the website actually loads.
function regenerateDataFile(tours) {
  const list = tours || loadTours();
  fs.writeFileSync(TOURS_DATA_JS, 'window.TOURS = ' + JSON.stringify(list) + ';\n');
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
    highlights: [], itinerary: [], images: [], tags: [], blurb: null
  };
}

// ---------- BLOG POSTS ----------
function loadPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8')); }
  catch (e) { return []; }
}
function savePosts(posts) {
  ensureDirs();
  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2));
  regeneratePostsFile(posts);
}
function regeneratePostsFile(posts) {
  const list = posts || loadPosts();
  fs.writeFileSync(POSTS_DATA_JS, 'window.POSTS = ' + JSON.stringify(list) + ';\n');
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
    date: '', cover: '', body: '', images: []
  };
}

// ---------- REVIEWS ----------
function loadReviews() { try { return JSON.parse(fs.readFileSync(REVIEWS_JSON, 'utf8')); } catch (e) { return []; } }
function saveReviews(list) { ensureDirs(); fs.writeFileSync(REVIEWS_JSON, JSON.stringify(list, null, 2)); regenerateReviews(list); }
function regenerateReviews(list) { const l = list || loadReviews(); fs.writeFileSync(REVIEWS_DATA_JS, 'window.REVIEWS = ' + JSON.stringify(l) + ';\n'); return l.length; }
function nextReviewId(list) { return (list.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) || 5000) + 1; }
function blankReview() {
  return { id: 0, name: '', country: '', text: '', rating: 5, avatar: '', placement: 'home' };
}

// ---------- GUIDES ----------
function loadGuides() { try { return JSON.parse(fs.readFileSync(GUIDES_JSON, 'utf8')); } catch (e) { return []; } }
function saveGuides(list) { ensureDirs(); fs.writeFileSync(GUIDES_JSON, JSON.stringify(list, null, 2)); regenerateGuides(list); }
function regenerateGuides(list) { const l = list || loadGuides(); fs.writeFileSync(GUIDES_DATA_JS, 'window.GUIDES = ' + JSON.stringify(l) + ';\n'); return l.length; }
function nextGuideId(list) { return (list.reduce((m, g) => Math.max(m, Number(g.id) || 0), 0) || 0) + 1; }
function blankGuide() { return { id: 0, name: '', role: '', languages: [], bio: '', photo: '' }; }

// ---------- SITE SETTINGS ----------
function loadSite() { try { return JSON.parse(fs.readFileSync(SITE_JSON, 'utf8')); } catch (e) { return {}; } }
function saveSite(obj) { ensureDirs(); fs.writeFileSync(SITE_JSON, JSON.stringify(obj, null, 2)); regenerateSite(obj); }
function regenerateSite(obj) { const o = obj || loadSite(); fs.writeFileSync(SITE_DATA_JS, 'window.SITE = ' + JSON.stringify(o) + ';\n'); }

// ---------- SIGHTS (global places map: key -> {name, photo, blurb}; bot-editable) ----------
function loadSights() { try { return JSON.parse(fs.readFileSync(SIGHTS_JSON, 'utf8')); } catch (e) { return {}; } }
function saveSights(obj) { ensureDirs(); fs.writeFileSync(SIGHTS_JSON, JSON.stringify(obj, null, 2)); regenerateSights(obj); }
function regenerateSights(obj) { const o = obj || loadSights(); fs.writeFileSync(SIGHTS_DATA_JS, 'window.SIGHTS = ' + JSON.stringify(o) + ';\n'); }

module.exports = {
  ROOT, TOURS_JSON, TOURS_DATA_JS, IMAGES_DIR,
  POSTS_JSON, POSTS_DATA_JS, POST_IMAGES_DIR,
  REVIEWS_JSON, REVIEWS_DATA_JS, REVIEW_IMAGES_DIR,
  GUIDES_JSON, GUIDES_DATA_JS, GUIDE_IMAGES_DIR,
  SITE_JSON, SITE_DATA_JS, SITE_IMAGES_DIR,
  SIGHTS_JSON, SIGHTS_DATA_JS, SIGHTS_IMAGES_DIR,
  ensureDirs, loadTours, saveTours, regenerateDataFile,
  loadPosts, savePosts, regeneratePostsFile,
  loadReviews, saveReviews, regenerateReviews, nextReviewId, blankReview,
  loadGuides, saveGuides, regenerateGuides, nextGuideId, blankGuide,
  loadSite, saveSite, regenerateSite,
  loadSights, saveSights, regenerateSights,
  slugify, uniqueSlug, nextId, blankTour,
  uniquePostSlug, nextPostId, readTime, blankPost
};
