#!/usr/bin/env node
/**
 * Builds the resized image copies (lib/imgvariants.js) ahead of the first visitor, so no one
 * waits for sharp. Optional: the server makes any missing copy on demand anyway.
 *
 *   node scripts/warm-images.js              # every photo under public/img and public/images
 *   node scripts/warm-images.js catalog      # only public/img/catalog
 *
 * Widths 480 and 800 in AVIF, WebP and JPEG (what phones and cards ask for); 1280 and 1600
 * only for photos wider than that. Already-built copies are skipped, so re-runs are cheap.
 */
const fs = require('fs');
const path = require('path');
const Variants = require('../lib/imgvariants');
const { imageSize } = require('../lib/imgsize');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const CACHE = path.join(ROOT, '.cache', 'img');
const ACCEPTS = ['image/avif', 'image/webp', '*/*'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jpe?g|png)$/i.test(name) && !/-t\.(jpe?g|png)$/i.test(name)) out.push(full);
  }
  return out;
}

async function main() {
  const sub = process.argv[2];
  const dirs = sub ? [path.join(PUBLIC, 'img', sub)] : [path.join(PUBLIC, 'img'), path.join(PUBLIC, 'images')];
  const files = dirs.flatMap(d => walk(d));
  let made = 0, t0 = Date.now();
  for (const [i, f] of files.entries()) {
    const size = imageSize(f);
    if (!size) continue;
    const rel = path.relative(PUBLIC, f);
    for (const w of Variants.WIDTHS) {
      if (size.width <= w) continue;
      if (w > 800 && size.width <= 1280) continue;   // hero-size copies only for photos that are bigger
      for (const a of ACCEPTS) { if (await Variants.variant(CACHE, PUBLIC, rel, w, a)) made++; }
    }
    if (i % 50 === 49) console.log(`${i + 1}/${files.length} photos, ${made} copies, ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  console.log(`done: ${files.length} photos, ${made} copies present, ${Math.round((Date.now() - t0) / 1000)} s`);
}
main().catch(e => { console.error(e); process.exit(1); });
