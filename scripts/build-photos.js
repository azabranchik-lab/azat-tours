#!/usr/bin/env node
/**
 * Turns the owner's camera originals into the web-sized files the site ships.
 *
 * The originals are 5184x3456 at ~900KB each. The browser never needs more than
 * 2000px (that is the widest entry in the hero srcset), places cards render at
 * 800 and the Instagram tiles are 400px squares, so shipping the originals would
 * cost seconds on a phone for pixels nobody sees.
 *
 * Output lands in public/img/, which is NOT gitignored (unlike public/images/,
 * which is server-owned and stripped from the deploy tar). These are brand
 * assets picked once, so they belong in git and must survive a deploy.
 *
 * Sources live outside the repo, so this is a one-off run whose output is
 * committed. Kept around for the next time a photo is swapped.
 *
 *   npm run build-photos
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = 'C:/Users/user/Downloads/Telegram Desktop';
const NEW = path.join(SRC, 'Новая папка');
const OUT = path.join(__dirname, '..', 'public', 'img');

// width: a single number, or a list when the markup carries a srcset.
// square: crop to 1:1 (the Instagram tiles are aspect-ratio:1/1 + object-fit:cover).
// noResize: already smaller than the target, so keep every pixel and only
//   re-encode — upscaling would invent detail, but the source is a heavy
//   high-quality JPEG and re-encoding cuts its weight several times over.
const JOBS = [
  // --- hero: one set for both mobile and desktop (owner's choice) ---
  // Same photo on every device, so no <picture> art direction — a plain srcset
  // at 800/1400/2000 lets the browser pick the right width for the viewport.
  { src: path.join(SRC, 'IMG_0793.JPG'), out: 'hero/hero-1-reflection',   width: [800, 1400, 2000] },
  { src: path.join(NEW, 'IMG_0340.JPG'), out: 'hero/hero-2-lake-view',    width: [800, 1400, 2000] },
  { src: path.join(SRC, 'IMG_1476.JPG'), out: 'hero/hero-3-ridge',        width: [800, 1400, 2000] },
  { src: path.join(SRC, 'IMG_0804.JPG'), out: 'hero/hero-4-yurts-meadow', width: [800, 1400, 2000] },
  { src: path.join(SRC, 'IMG_9443.JPG'), out: 'hero/hero-5-yurts-lake',   width: [800, 1400, 2000] },

  // --- places: named locations, so each file must actually show that place ---
  { src: path.join(NEW, 'IMG_9456.JPG'), out: 'places/song-kol',  width: 800 },
  { src: path.join(SRC, 'IMG_0948.JPG'), out: 'places/kel-suu',   noResize: true },
  { src: path.join(NEW, 'IMG_9870.JPG'), out: 'places/issyk-kul', width: 800 },

  // --- instagram: 400px squares ---
  // IMG_1715 moved to the mobile hero, so this tile gets another people shot
  // rather than repeating a photo the page already shows.
  { src: path.join(NEW, 'IMG_1566.JPG'), out: 'ig/ig-1-riders-mist', width: 400, square: true },
  // 'attention' put the square on the guide alone and sliced the traveller in
  // half at the right edge; the two of them straddle the frame, so a centre
  // crop is the only one that keeps both.
  { src: path.join(NEW, 'IMG_7443.JPG'), out: 'ig/ig-2-guide-taigan', width: 400, square: true, position: 'centre' },
  { src: path.join(NEW, 'IMG_9927.JPG'), out: 'ig/ig-3-kalpak',      width: 400, square: true },
  { src: path.join(NEW, 'IMG_1482.JPG'), out: 'ig/ig-4-trail',       width: 400, square: true },
  { src: path.join(NEW, 'IMG_1459.JPG'), out: 'ig/ig-5-pass',        width: 400, square: true },
  { src: path.join(NEW, 'IMG_0007.JPG'), out: 'ig/ig-6-balbals',     width: 400, square: true },
];

async function main() {
  let missing = 0;
  for (const job of JOBS) {
    if (!fs.existsSync(job.src)) {
      console.error('MISSING  ' + job.src);
      missing++;
    }
  }
  if (missing) {
    console.error('\n' + missing + ' source file(s) missing, nothing written.');
    process.exit(1);
  }

  for (const job of JOBS) {
    const dir = path.join(OUT, path.dirname(job.out));
    fs.mkdirSync(dir, { recursive: true });

    if (job.noResize) {
      const name = job.out + '.jpg';
      const dest = path.join(OUT, name);
      await sharp(job.src).rotate().jpeg({ quality: 82, mozjpeg: true }).toFile(dest);
      report(name, dest, await sharp(dest).metadata());
      continue;
    }

    for (const w of [].concat(job.width)) {
      // Single width keeps the plain name so the markup stays readable;
      // a srcset set gets the width suffix.
      const many = Array.isArray(job.width) && job.width.length > 1;
      const name = job.out + (many ? '-' + w : '') + '.jpg';
      const dest = path.join(OUT, name);

      let img = sharp(job.src).rotate();
      img = job.square
        ? img.resize(w, w, { fit: 'cover', position: job.position || sharp.strategy.attention })
        : img.resize({ width: w, withoutEnlargement: true });

      await img.jpeg({ quality: 82, mozjpeg: true }).toFile(dest);
      const m = await sharp(dest).metadata();
      report(name, dest, m);
    }
  }
}

function report(name, dest, m) {
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(String(kb).padStart(5) + ' KB  ' + String(m.width + 'x' + m.height).padEnd(10) + '  ' + name);
}

main().catch(e => { console.error(e); process.exit(1); });
