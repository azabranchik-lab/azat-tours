// Pixel size of a local image, read synchronously from the file header (JPEG, PNG,
// WebP, GIF). Used to put width/height on every <img> the server renders, so the
// browser reserves the box before the picture arrives. Results are cached per file
// and refreshed when the file changes, so the cost is one small read per image.
const fs = require('fs');

const cache = new Map();   // absolute path -> { m: mtimeMs, size: {width,height} | null }

function readAt(fd, pos, len) {
  const buf = Buffer.alloc(len);
  const n = fs.readSync(fd, buf, 0, len, pos);
  return n === len ? buf : buf.subarray(0, n);
}

function jpeg(fd, fileSize) {
  // Walk the segments until a start-of-frame marker (SOFn) with the dimensions.
  let pos = 2;
  for (let i = 0; i < 1000 && pos + 9 < fileSize; i++) {
    const h = readAt(fd, pos, 9);
    if (h.length < 4 || h[0] !== 0xFF) return null;
    const marker = h[1];
    if (marker === 0xFF) { pos++; continue; }                          // fill byte
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { pos += 2; continue; }   // no length
    if (marker === 0xD9 || marker === 0xDA) return null;               // end of image / scan data: no SOF found
    const len = h.readUInt16BE(2);
    const isSof = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isSof) { if (h.length < 9) return null; return { height: h.readUInt16BE(5), width: h.readUInt16BE(7) }; }
    pos += 2 + len;
  }
  return null;
}

function parse(fd, fileSize) {
  const head = readAt(fd, 0, 32);
  if (head.length < 24) return null;
  if (head[0] === 0xFF && head[1] === 0xD8) return jpeg(fd, fileSize);
  if (head.toString('ascii', 1, 4) === 'PNG') return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = head.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { width: head.readUInt16LE(26) & 0x3fff, height: head.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const b = head.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { width: 1 + head.readUIntLE(24, 3), height: 1 + head.readUIntLE(27, 3) };
    return null;
  }
  if (head.toString('ascii', 0, 3) === 'GIF') return { width: head.readUInt16LE(6), height: head.readUInt16LE(8) };
  return null;
}

// { width, height } or null when the file is missing or not a known raster format.
function imageSize(absPath) {
  let st;
  try { st = fs.statSync(absPath); } catch (e) { return null; }
  const hit = cache.get(absPath);
  if (hit && hit.m === st.mtimeMs) return hit.size;
  let size = null, fd;
  try { fd = fs.openSync(absPath, 'r'); size = parse(fd, st.size); }
  catch (e) { size = null; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  if (size && !(size.width > 0 && size.height > 0)) size = null;
  cache.set(absPath, { m: st.mtimeMs, size });
  return size;
}

module.exports = { imageSize };
