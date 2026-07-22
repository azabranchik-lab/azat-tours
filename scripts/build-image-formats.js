#!/usr/bin/env node
/**
 * Generates modern AVIF + WebP variants next to every JPEG/PNG in public/img/.
 *
 * The site ships heavy JPEGs (the catalog alone is ~44 MB across 340 photos).
 * AVIF is typically ~30% of a JPEG's weight and WebP ~70%, both at the same
 * visual quality, so serving them cuts page weight hard — especially on phones,
 * which is our primary surface.
 *
 * How the variants are used: server.js negotiates on the request's Accept
 * header and serves `<file>.avif` / `<file>.webp` when the browser supports it
 * and the file exists, falling back to the original JPEG otherwise. That means
 * NO markup changes — the DOM keeps requesting `foo.jpg`; only the bytes on the
 * wire change. See server.js "static" handler.
 *
 * Naming: variants keep the full original name and append the new extension —
 * `foo.jpg` -> `foo.jpg.avif` / `foo.jpg.webp`. Appending (not replacing) keeps
 * an unambiguous 1:1 map from the requested path to its variant and never
 * collides if a `.png` and `.jpg` ever share a stem.
 *
 * Like the JPEGs themselves, the variants are committed to git (sharp is a
 * devDependency and won't exist on the production server, so they can't be
 * generated at deploy). public/img/ is not gitignored, so they ship with code.
 *
 * Idempotent + resumable: a variant is (re)built only when missing or older
 * than its source, so re-runs are cheap and a killed run just continues.
 *
 *   npm run build-image-formats            # whole public/img tree
 *   node scripts/build-image-formats.js catalog hero   # only these subdirs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMG_ROOT = path.join(__dirname, '..', 'public', 'img');
const SRC_RE = /\.(jpe?g|png)$/i;

// AVIF at q50/effort4 is a good weight/quality/CPU balance for photographic
// content; WebP at q80 matches the JPEGs' q82 look while staying lighter.
const AVIF = { quality: 50, effort: 4 };
const WEBP = { quality: 80 };

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SRC_RE.test(name)) out.push(full);
  }
  return out;
}

// A variant is stale when it is missing or older than its source.
function stale(variant, srcMtimeMs) {
  try { return fs.statSync(variant).mtimeMs < srcMtimeMs; }
  catch { return true; }
}

async function main() {
  const args = process.argv.slice(2);
  const roots = args.length
    ? args.map(a => path.join(IMG_ROOT, a))
    : [IMG_ROOT];

  const sources = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) { console.error('skip (not found): ' + r); continue; }
    walk(r, sources);
  }
  sources.sort();

  let built = 0, skipped = 0;
  let srcBytes = 0, avifBytes = 0, webpBytes = 0;

  for (const src of sources) {
    const srcStat = fs.statSync(src);
    srcBytes += srcStat.size;
    const rel = path.relative(IMG_ROOT, src);

    for (const [ext, encode] of [['.avif', img => img.avif(AVIF)], ['.webp', img => img.webp(WEBP)]]) {
      const dest = src + ext;
      if (!stale(dest, srcStat.mtimeMs)) {
        skipped++;
        (ext === '.avif' ? (avifBytes += size(dest)) : (webpBytes += size(dest)));
        continue;
      }
      // No .rotate(): the on-disk JPEG/PNG is already correctly oriented
      // (build-photos.js and the catalog downloader baked orientation in),
      // so re-encode the pixels as-is to avoid a double rotation.
      await encode(sharp(src)).toFile(dest);
      built++;
      (ext === '.avif' ? (avifBytes += size(dest)) : (webpBytes += size(dest)));
    }
    if ((built + skipped) % 100 === 0) process.stdout.write('.');
  }

  const mb = b => (b / 1048576).toFixed(1) + ' MB';
  console.log('\n\nSources: ' + sources.length + '  (' + mb(srcBytes) + ')');
  console.log('Variants built: ' + built + ', up-to-date: ' + skipped);
  console.log('AVIF total: ' + mb(avifBytes) + '  (' + pct(avifBytes, srcBytes) + ' of JPEG)');
  console.log('WebP total: ' + mb(webpBytes) + '  (' + pct(webpBytes, srcBytes) + ' of JPEG)');
}

function size(f) { try { return fs.statSync(f).size; } catch { return 0; } }
function pct(a, b) { return b ? Math.round((a / b) * 100) + '%' : 'n/a'; }

main().catch(e => { console.error(e); process.exit(1); });
