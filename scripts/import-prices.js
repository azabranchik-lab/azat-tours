#!/usr/bin/env node
/**
 * Sets the starting price of tours from a CSV the owner fills in (seo-audit/prices-todo.csv).
 *
 *   node scripts/import-prices.js seo-audit/prices-todo.csv --dry   # show the changes
 *   node scripts/import-prices.js seo-audit/prices-todo.csv         # apply to content/tours.json
 *
 * Columns: slug, priceFrom (USD per person, whole number; empty or 0 = leave "on request"),
 * priceNote (optional, e.g. "per person, group of 4, high season"). Other columns are ignored.
 * Run on the server (or add a migration) so the bot's copy of the content gets the prices.
 */
const fs = require('fs');
const content = require('../lib/content');

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
  const head = split(lines.shift()).map(h => h.toLowerCase());
  return lines.map(l => Object.fromEntries(head.map((h, i) => [h, split(l)[i] || ''])));
}

const file = process.argv[2], dry = process.argv.includes('--dry');
if (!file) { console.error('usage: import-prices.js <csv> [--dry]'); process.exit(2); }
const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const tours = content.loadTours();
let changed = 0;
for (const row of rows) {
  const t = tours.find(x => x.slug === row.slug);
  if (!t) { console.log('  unknown slug: ' + row.slug); continue; }
  const price = Math.round(Number(String(row.pricefrom || '').replace(/[^\d.]/g, '')) || 0);
  const note = (row.pricenote || '').trim();
  if (!price && !note) continue;
  if (t.priceFrom !== price || (t.priceNote || '') !== note) {
    console.log(`  ${t.slug}: ${t.priceFrom || 'on request'} → ${price ? 'from $' + price : 'on request'}${note ? ' (' + note + ')' : ''}`);
    t.priceFrom = price; t.priceNote = note; changed++;
  }
}
console.log((dry ? '[dry] would change ' : 'changed ') + changed + ' tour(s)');
if (changed && !dry) content.saveTours(tours);
