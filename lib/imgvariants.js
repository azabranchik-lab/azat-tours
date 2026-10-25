// Resized copies of site images for srcset: /img/catalog/x.jpg?w=480 is served as a
// 480 px wide AVIF/WebP/JPEG (by the browser's Accept header), built once with sharp
// and kept in <root>/.cache/img/. The originals in public/ are never touched, and a
// photo added through the bot gets its variants the first time a browser asks.
//
// Only the widths in WIDTHS are ever produced (a stranger cannot ask for arbitrary
// sizes), and a source narrower than the requested width is served as it is.
const fs = require('fs');
const path = require('path');
const { imageSize } = require('./imgsize');

let sharp = null;
try { sharp = require('sharp'); sharp.cache(false); } catch (e) { /* no sharp: originals only */ }

const WIDTHS = [480, 800, 1280, 1600];
const FORMATS = {
  avif: { type: 'image/avif', make: img => img.avif({ quality: 50, effort: 3 }) },
  webp: { type: 'image/webp', make: img => img.webp({ quality: 80 }) },
  jpeg: { type: 'image/jpeg', make: img => img.jpeg({ quality: 82, mozjpeg: true }) },
};
const CONCURRENCY = 2;

// Picks the lightest format the browser accepts (same order as server.js negotiation).
function formatFor(accept) {
  const a = accept || '';
  if (/image\/avif/.test(a)) return 'avif';
  if (/image\/webp/.test(a)) return 'webp';
  return 'jpeg';
}

const inflight = new Map();   // variant path -> Promise
let running = 0;
const queue = [];
function slot() {
  return new Promise(resolve => { queue.push(resolve); pump(); });
}
function pump() { while (running < CONCURRENCY && queue.length) { running++; queue.shift()(); } }
function release() { running--; pump(); }

// Resolves to { path, type } of the file to send, or null when the original should
// be served instead (too small, unsupported, sharp missing, or any failure).
async function variant(cacheDir, publicDir, relPath, width, accept) {
  if (!sharp || !WIDTHS.includes(width)) return null;
  const src = path.join(publicDir, relPath);
  const size = imageSize(src);
  if (!size || size.width <= width) return null;
  const fmt = formatFor(accept);
  const out = path.join(cacheDir, relPath + '-w' + width + '.' + fmt);
  let srcStat;
  try { srcStat = fs.statSync(src); } catch (e) { return null; }
  try {
    const st = fs.statSync(out);
    if (st.size > 0 && st.mtimeMs >= srcStat.mtimeMs) return { path: out, type: FORMATS[fmt].type };
  } catch (e) { /* not built yet */ }
  if (!inflight.has(out)) {
    inflight.set(out, (async () => {
      await slot();
      try {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        const buf = await FORMATS[fmt].make(sharp(src).rotate().resize({ width, withoutEnlargement: true })).toBuffer();
        const tmp = out + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, out);
        return { path: out, type: FORMATS[fmt].type };
      } finally { release(); inflight.delete(out); }
    })());
  }
  try { return await inflight.get(out); }
  catch (e) { console.error('image variant failed', relPath, width, fmt, e.message); return null; }
}

module.exports = { WIDTHS, FORMATS, formatFor, variant };
