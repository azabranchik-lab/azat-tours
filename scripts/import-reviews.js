#!/usr/bin/env node
/**
 * Adds guest reviews from a file the owner prepares to content/reviews.json (the same store the
 * admin bot edits). Template: seo-audit/reviews-template.csv.
 *
 *   node scripts/import-reviews.js reviews.csv            # add new reviews
 *   node scripts/import-reviews.js reviews.csv --dry      # show what would be added
 *   node scripts/import-reviews.js reviews.json           # the same columns as JSON objects
 *
 * Columns: name, country, date (2026-07 or 2026-07-14), tour_slug (optional, must exist), text,
 * source (tripadvisor | google | getyourguide | direct), source_url (optional), rating (1-5,
 * default 5), placement (home | reviews | tour; default: tour when tour_slug is set, else reviews).
 * A review already present (same name + text) is skipped, so the file can be re-run.
 */
const fs = require('fs');
const path = require('path');
const content = require('../lib/content');

const SOURCES = ['tripadvisor', 'google', 'getyourguide', 'direct'];

function parseCsv(text) {
  const rows = [], re = /("([^"]|"")*"|[^,\r\n]*)(,|\r?\n|$)/g;
  let row = [], m;
  text = text.replace(/^﻿/, '');
  while ((m = re.exec(text)) && m[0] !== '') {
    row.push(m[1].startsWith('"') ? m[1].slice(1, -1).replace(/""/g, '"') : m[1]);
    if (m[3] !== ',') { rows.push(row); row = []; }
    if (re.lastIndex >= text.length) break;
  }
  const head = rows.shift().map(h => h.trim().toLowerCase());
  return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

function main() {
  const file = process.argv[2], dry = process.argv.includes('--dry');
  if (!file) { console.error('usage: import-reviews.js <file.csv|file.json> [--dry]'); process.exit(2); }
  const raw = fs.readFileSync(file, 'utf8');
  const rows = /\.json$/i.test(file) ? JSON.parse(raw) : parseCsv(raw);
  const tours = content.publishedOnly(content.loadTours());
  const reviews = content.loadReviews();
  const key = r => (r.name + '|' + r.text).toLowerCase().replace(/\s+/g, ' ').trim();
  const have = new Set(reviews.map(key));
  const added = [], problems = [];
  rows.forEach((row, i) => {
    const r = Object.assign(content.blankReview(), {
      name: row.name || row.author || '', country: row.country || '', date: row.date || '', text: row.text || '',
      source: (row.source || 'direct').toLowerCase(), sourceUrl: row.source_url || row.sourceurl || '',
      rating: Math.max(1, Math.min(5, Number(row.rating) || 5)), tourSlug: row.tour_slug || row.tourslug || '', avatar: '',
    });
    const line = 'row ' + (i + 2) + ' (' + (r.name || 'no name') + ')';
    if (!r.name || !r.text) return problems.push(line + ': name and text are required');
    if (!SOURCES.includes(r.source)) return problems.push(line + ': source must be one of ' + SOURCES.join(', '));
    if (r.sourceUrl && !/^https?:\/\//.test(r.sourceUrl)) return problems.push(line + ': source_url must start with https://');
    if (r.tourSlug && !tours.some(t => t.slug === r.tourSlug)) return problems.push(line + ': unknown tour slug ' + r.tourSlug);
    const place = (row.placement || '').toLowerCase();
    r.placement = place === 'home' ? 'home' : place === 'tour' || (!place && r.tourSlug) ? 'tour:' + r.tourSlug : 'reviews';
    if (have.has(key(r))) return;
    have.add(key(r));
    r.id = content.nextReviewId(reviews.concat(added));
    added.push(r);
  });
  if (problems.length) { console.error('Not imported:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log((dry ? '[dry] would add ' : 'added ') + added.length + ' review(s); ' + (rows.length - added.length) + ' already present');
  added.forEach(r => console.log('  ' + r.name + ' (' + (r.country || '?') + ') ' + r.source + ' → ' + r.placement));
  if (added.length && !dry) content.saveReviews(added.concat(reviews));
}
main();
