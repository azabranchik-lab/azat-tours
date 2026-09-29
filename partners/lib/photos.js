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

const REQUIRED_ANGLES = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'INTERIOR_FRONT', 'INTERIOR_BACK', 'TRUNK', 'DASHBOARD'];
const MAX_EXTRA = 5;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];
const MIN_SHORT_SIDE = 600;
const MAIN = { size: 1600, quality: 80, fallbackQuality: 70, maxBytes: 1024 * 1024 };
const THUMB = { size: 480, quality: 75 };

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
  try { meta = await sharp(buf).metadata(); } catch (e) { return { ok: false, error: 'photo_format' }; }
  if (!ALLOWED_FORMATS.includes(meta.format)) return { ok: false, error: 'photo_format' };
  if (Math.min(meta.width || 0, meta.height || 0) < MIN_SHORT_SIDE) return { ok: false, error: 'photo_small' };

  const resize = (s, q) => sharp(buf).rotate()
    .resize({ width: s, height: s, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: q })
    .toBuffer({ resolveWithObject: true });

  let main = await resize(MAIN.size, MAIN.quality);
  if (main.data.length > MAIN.maxBytes) main = await resize(MAIN.size, MAIN.fallbackQuality);
  const thumb = await resize(THUMB.size, THUMB.quality);
  return { ok: true, main: main.data, thumb: thumb.data, width: main.info.width, height: main.info.height };
}

// Next required angle without a photo, or null when all 8 are in.
function nextMissingAngle(photos) {
  const have = new Set(photos.map(p => p.angle));
  return REQUIRED_ANGLES.find(a => !have.has(a)) || null;
}

const missingAngles = photos => REQUIRED_ANGLES.filter(a => !photos.some(p => p.angle === a));
const extraCount = photos => photos.filter(p => p.angle === 'EXTRA').length;

module.exports = {
  REQUIRED_ANGLES, MAX_EXTRA, ALLOWED_MIME,
  checkIncoming, processImage, nextMissingAngle, missingAngles, extraCount
};
