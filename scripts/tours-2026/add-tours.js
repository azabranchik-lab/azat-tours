#!/usr/bin/env node
/**
 * Adds the 2026 tour pack (scripts/tours-2026/tours.json: day trips and short tours) to
 * content/tours.json. Runs once on the server through scripts/migrate.js; can also
 * be run by hand. Safe to re-run: a tour whose importKey is already in the content
 * is skipped, so edits made in the bot are never overwritten.
 *
 * New tours arrive as drafts by default: the owner reviews them in the bot
 * (📝 Drafts, "Preview on site") and publishes. Pass --publish to add them live.
 *
 *   node scripts/tours-2026/add-tours.js            # add missing tours as drafts
 *   node scripts/tours-2026/add-tours.js --dry      # show what would be added
 *   node scripts/tours-2026/add-tours.js --publish  # add missing tours as published
 */
const path = require('path');
const content = require('../../lib/content');

const SRC = path.join(__dirname, 'tours.json');
// Fields a tour may carry in tours.json; anything else is ignored.
const FIELDS = ['name', 'cats', 'category', 'duration', 'days', 'season', 'start_from', 'tour_speed', 'accommodations',
  'activities', 'total_drive', 'summary', 'highlights', 'itinerary', 'images', 'tags', 'places', 'blurb', 'priceFrom', 'priceNote', 'series'];

function addTours({ dry = false, publish = false } = {}) {
  const src = require(SRC);
  const tours = content.loadTours();
  const have = new Set(tours.map(t => t.importKey).filter(Boolean));
  const added = [];
  for (const s of src) {
    if (!s.importKey || have.has(s.importKey)) continue;
    const t = content.blankTour();
    for (const f of FIELDS) if (s[f] !== undefined) t[f] = s[f];
    t.importKey = s.importKey;
    t.id = content.nextId(tours);
    t.slug = content.uniqueSlug(s.slug || s.name, tours);
    t.status = publish ? 'published' : 'draft';
    tours.push(t);
    added.push(t);
  }
  if (added.length && !dry) content.saveTours(tours);
  console.log(`${dry ? '[dry] would add' : 'added'} ${added.length} tour(s)${publish ? ' (published)' : ' as drafts'}; ${src.length - added.length} already present`);
  added.forEach(t => console.log(`  ${t.id}  ${t.slug}  ${t.priceFrom ? 'from $' + t.priceFrom : 'on request'}`));
  return added.length;
}

if (require.main === module) addTours({ dry: process.argv.includes('--dry'), publish: process.argv.includes('--publish') });
module.exports = { addTours };
