// Photo checks and processing (SPEC §6.4). Pure/async helpers, no Telegram.
const sharp = require('sharp');

// Several partners may upload at once (the bot handles users in parallel). Keep
// sharp lean and process at most MAX_PARALLEL images at a time.
sharp.cache(false);
sharp.concurrency(2);
const MAX_PARALLEL = 2;
let active = 0;
const waiting = [];
async function limited(fn) {
  if (active >= MAX_PARALLEL) await new Promise(resolve => waiting.push(resolve));
  active++;
  try { return await fn(); } finally {
    active--;
    const next = waiting.shift();
    if (next) next();
  }
}

// Since 2026-10-17 (owner): 4 to 6 photos in any order, the first one is the cover.
// They are stored with angle 'EXTRA' and ordered by sortOrder; cars from before keep
// their angle photos (FRONT … DASHBOARD sort first).
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 6;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];
const MIN_SHORT_SIDE = 600;
const MAIN = { size: 1600, quality: 80, fallbackQuality: 70, maxBytes: 1024 * 1024 };
const THUMB = { size: 480, quality: 75 };
// Decompression-bomb guard: a small file that decodes to a gigantic image is refused
// (50 MP covers any phone camera; sharp's default is 268 MP).
const SHARP_INPUT = { limitInputPixels: 50_000_000, failOn: 'error' };

// Before downloading: what Telegram tells us about the file.
// kind: 'photo' (always JPEG from Telegram) or 'document'.
function checkIncoming({ kind, mime, fileName, size }, maxMb) {
  if (kind === 'document') {
    const name = String(fileName || '').toLowerCase();
    if (!ALLOWED_MIME.includes(String(mime || '').toLowerCase()) || /\.(heic|heif)$/.test(name)) return { ok: false, error: 'photo_format' };
  } else if (kind !== 'photo') {
    return { ok: false, error: 'photo_format' };
  }
  if (size && size > maxMb * 1024 * 1024) return { ok: false, error: 'photo_too_big' };
  return { ok: true };
}

// After downloading: check the real content, then produce WebP main + thumb.
// EXIF/GPS are dropped (sharp strips metadata unless asked to keep it).
function processImage(buf) {
  return limited(() => processImageNow(buf));
}

async function processImageNow(buf) {
  let meta;
  try { meta = await sharp(buf, SHARP_INPUT).metadata(); } catch (e) { return { ok: false, error: 'photo_format' }; }
  if ((meta.width || 0) * (meta.height || 0) > SHARP_INPUT.limitInputPixels) return { ok: false, error: 'photo_format' };
  if (!ALLOWED_FORMATS.includes(meta.format)) return { ok: false, error: 'photo_format' };
  if (Math.min(meta.width || 0, meta.height || 0) < MIN_SHORT_SIDE) return { ok: false, error: 'photo_small' };

  const resize = (s, q) => sharp(buf, SHARP_INPUT).rotate()
    .resize({ width: s, height: s, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: q })
    .toBuffer({ resolveWithObject: true });

  let main = await resize(MAIN.size, MAIN.quality);
  if (main.data.length > MAIN.maxBytes) main = await resize(MAIN.size, MAIN.fallbackQuality);
  const thumb = await resize(THUMB.size, THUMB.quality);
  return { ok: true, main: main.data, thumb: thumb.data, width: main.info.width, height: main.info.height };
}

// A stored WebP re-encoded as JPEG for Telegram (albums, «Файлы для сайта»), under the
// same concurrency limit as uploads, so several albums at once cannot overload the server.
function toJpeg(buf, quality) {
  return limited(() => sharp(buf, SHARP_INPUT).jpeg({ quality }).toBuffer());
}

// How many more photos a car needs before it can be sent (0 when enough).
const photosNeeded = photos => Math.max(0, MIN_PHOTOS - photos.length);

module.exports = {
  MIN_PHOTOS, MAX_PHOTOS, ALLOWED_MIME,
  checkIncoming, processImage, photosNeeded, toJpeg
};
