// Photos uploaded through the admin bot: keep them light for phones.
//
// For every photo we write next to each other:
//   foo.jpg          main file (max 1600 px; Telegram's own JPEG kept as-is when it is already small)
//   foo.jpg.webp     WebP copy of the main file
//   foo-t.jpg        480 px preview for list cards
//   foo-t.jpg.webp   WebP copy of the preview
// server.js already answers a request for foo.jpg with foo.jpg.webp when the browser
// supports WebP (same naming as scripts/build-image-formats.js), so pages keep using
// plain .jpg paths. The JPEG stays the main file because the bot sends it back to
// Telegram as an album and link previews (WhatsApp, Facebook) want JPEG.
//
// It never throws: if sharp is missing or fails, the original bytes are saved as before
// (plus a copy as the preview), so a photo is never lost; it is just heavier.
// Runs inside the site process (pm2 limit 500 MB), so one photo at a time and no cache.
const fs = require('fs');
const path = require('path');

let sharp = null;
try {
  sharp = require('sharp');
  sharp.cache(false);
  sharp.concurrency(1);
} catch (e) {
  console.error('images: sharp unavailable, bot photos are saved as sent:', e.message);
}

const MAIN = { size: 1600, quality: 82 };
const THUMB = { size: 480, quality: 78 };
const WEBP_QUALITY = 80;
// A small file that decodes to a gigantic image is refused (50 MP covers any phone).
const INPUT = { limitInputPixels: 50_000_000 };

// foo.jpg -> foo-t.jpg (any image extension)
const thumbOf = rel => String(rel).replace(/(\.[a-z0-9]+)$/i, '-t$1');
const siblings = rel => [rel, rel + '.webp', rel + '.avif', thumbOf(rel), thumbOf(rel) + '.webp', thumbOf(rel) + '.avif'];

let chain = Promise.resolve();
const queued = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };

async function processNow(buf, absJpg) {
  const meta = await sharp(buf, INPUT).metadata();
  const big = Math.max(meta.width || 0, meta.height || 0) > MAIN.size;
  // Telegram photos are already oriented, stripped of EXIF and compressed: re-encoding
  // them would only lose quality. Anything else (big, rotated, PNG) is normalised.
  const keep = meta.format === 'jpeg' && !big && (!meta.orientation || meta.orientation === 1) && !meta.exif;
  const base = () => sharp(buf, INPUT).rotate();
  const main = keep ? buf : await base()
    .resize({ width: MAIN.size, height: MAIN.size, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: MAIN.quality, mozjpeg: true })
    .toBuffer();
  const thumb = await base()
    .resize({ width: THUMB.size, height: THUMB.size, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: THUMB.quality, mozjpeg: true })
    .toBuffer();
  const absThumb = thumbOf(absJpg);
  fs.writeFileSync(absJpg, main);
  fs.writeFileSync(absJpg + '.webp', await sharp(main).webp({ quality: WEBP_QUALITY }).toBuffer());
  fs.writeFileSync(absThumb, thumb);
  fs.writeFileSync(absThumb + '.webp', await sharp(thumb).webp({ quality: WEBP_QUALITY }).toBuffer());
}

// Save a photo. absNoExt: target path without extension; ext: the original extension
// (used only when sharp is unavailable). Returns { file, degraded }: `file` is the
// basename that was written (foo.jpg), `degraded` is true when saved unprocessed.
function save(buf, absNoExt, ext) {
  return queued(async () => {
    fs.mkdirSync(path.dirname(absNoExt), { recursive: true });
    if (sharp) {
      const absJpg = absNoExt + '.jpg';
      try {
        await processNow(buf, absJpg);
        return { file: path.basename(absJpg), degraded: false };
      } catch (e) {
        console.error('images: could not process a photo, saving it as sent:', e.message);
        siblings(absJpg).forEach(f => { try { fs.unlinkSync(f); } catch (e2) {} });
      }
    }
    const abs = absNoExt + (ext || '.jpg');
    fs.writeFileSync(abs, buf);
    fs.writeFileSync(thumbOf(abs), buf);
    return { file: path.basename(abs), degraded: true };
  });
}

// Delete a photo and every copy made from it. abs: absolute path of the main file.
function remove(abs) {
  siblings(abs).forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
}

module.exports = { save, remove, thumbOf, available: () => !!sharp, _setSharp: s => { sharp = s; } };
