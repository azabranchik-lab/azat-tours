#!/usr/bin/env node
/**
 * One-time, idempotent cleanup of scraped tour NAMES and SUMMARIES.
 *
 * The tour catalogue was scraped and every `name` came in SHOUTING CAPS
 * ("BEST OF KYRGYZSTAN - 12 DAYS"), a couple carry a double-escaped ampersand
 * ("...HORSE RIDING &#038; TREKKING..."), and two `summary` fields advertise the
 * source competitor by name ("...horseback journey with Kyrgyz Riders."). Those
 * strings flow into <title>, og:title, JSON-LD, the H1, breadcrumb, alt text,
 * the catalogue cards and the WhatsApp prefill — i.e. the whole conversion core
 * and every SERP/social preview.
 *
 * Fixing the DATA (not each renderer) corrects all of those surfaces at once and
 * touches none of the fragile render engines. `content.saveTours` rewrites
 * content/tours.json AND regenerates public/tours-data.js (the file the site
 * actually reads), both committed like the rest of the generated data.
 *
 * Idempotent: names are only Title-Cased when still fully UPPERCASE, so a second
 * run — or a future properly-cased bot edit — is left untouched. Summaries only
 * lose the exact "with Kyrgyz Riders" phrase, so re-running is a no-op.
 *
 * ⚠ DEPLOY: content/tours.json is server-authoritative (bot-owned) and excluded
 * from the deploy tar, so the server keeps its own SHOUTING copy. Run this ONCE
 * on the server after pulling this change (next to localize-catalog-images.js):
 *     node scripts/normalize-tour-names.js
 * After that the server data is clean permanently and later regenerations stay clean.
 *
 *   node scripts/normalize-tour-names.js --dry   # preview every change, write nothing
 *   node scripts/normalize-tour-names.js         # apply + regenerate tours-data.js
 */
const content = require('../lib/content');

// Short words that stay lowercase inside a title (unless they lead it).
const SMALL = new Set(['of', 'to', 'in', 'a', 'on', 'the', 'and', 'or', 'for', 'with', 'vs', 'at', 'by']);

function decodeEntities(s) {
  return String(s)
    .replace(/&#0*38;/g, '&')  // &#038; / &#38; -> &
    .replace(/&amp;/g, '&');   // already-escaped ampersand
}

// Hyphen-aware so "song-kol" -> "Song-Kol" and "ala-kol:" -> "Ala-Kol:".
function capWord(w) {
  return w.split('-').map(p => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join('-');
}

function toTitleCase(str) {
  let wi = 0;
  return str.toLowerCase().split(/(\s+)/).map(tok => {
    if (tok === '' || /^\s+$/.test(tok)) return tok;
    const first = wi === 0; wi++;
    if (!first && SMALL.has(tok)) return tok;
    return capWord(tok);
  }).join('');
}

function cleanName(name) {
  if (!name) return name;
  let s = decodeEntities(name).replace(/\s+/g, ' ').trim();
  const screamed = !/[a-z]/.test(s);               // decide before we touch casing
  s = s.replace(/\s*-\s*(\d+)\s*(days?)\s*$/i, ' - $1 $2'); // fix "WEEK- 7 DAYS" spacing, keep case
  if (screamed) s = toTitleCase(s);
  return s;
}

// Remove the source competitor's brand from customer-facing copy. Precise on the
// two known phrasings; anything else is reported for a human, never auto-mangled.
function cleanSummary(text) {
  if (!text) return text;
  return String(text).replace(/\s+with\s+Kyrgyz\s+Riders\b/gi, '').replace(/\s{2,}/g, ' ').trim();
}

function main() {
  const dry = process.argv.includes('--dry');
  const tours = content.loadTours();
  let nameChanges = 0, sumChanges = 0;

  for (const t of tours) {
    const n = cleanName(t.name);
    if (n !== t.name) { console.log('NAME  ' + t.name + '\n   -> ' + n + '\n'); t.name = n; nameChanges++; }
    if (t.summary) {
      const s = cleanSummary(t.summary);
      if (s !== t.summary) { console.log('SUMMARY [' + t.slug + '] stripped competitor brand'); t.summary = s; sumChanges++; }
    }
  }

  // Safety net: flag any remaining brand mention a human should look at.
  const leftover = tours.filter(t => /kyrgyz\s*riders/i.test(t.summary || '') || /kyrgyz\s*riders/i.test(t.name || ''));
  if (leftover.length) console.log('\n⚠ still mentions "Kyrgyz Riders": ' + leftover.map(t => t.slug).join(', '));

  console.log('\n' + nameChanges + ' name(s), ' + sumChanges + ' summary(ies) changed.');
  if (dry) { console.log('(dry run — nothing written)'); return; }
  if (nameChanges || sumChanges) { content.saveTours(tours); console.log('Wrote content/tours.json + regenerated public/tours-data.js'); }
  else console.log('Nothing to change (already normalized).');
}

main();
