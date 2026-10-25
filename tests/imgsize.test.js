// lib/imgsize.js: image dimensions from file headers, and lib/imgvariants.js: resized copies.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { imageSize } = require('../lib/imgsize');
const Variants = require('../lib/imgvariants');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'azat-imgsize-'));
const make = (w, h, fmt, opts) => {
  const img = sharp({ create: { width: w, height: h, channels: 3, background: '#4e7a8f' } });
  return fmt === 'png' ? img.png().toBuffer() : fmt === 'webp' ? img.webp(opts).toBuffer() : img.jpeg(opts).toBuffer();
};

test('reads JPEG, PNG and WebP sizes, including a JPEG with a big metadata block', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.jpg'), await make(1280, 960, 'jpeg', { quality: 80 }));
  fs.writeFileSync(path.join(dir, 'b.png'), await make(321, 123, 'png'));
  fs.writeFileSync(path.join(dir, 'c.webp'), await make(640, 480, 'webp', { lossless: false }));
  fs.writeFileSync(path.join(dir, 'd.webp'), await make(64, 48, 'webp', { lossless: true }));
  // JPEG with a large ICC-like APP2 segment before the frame header (80 KB, beyond any single read)
  const base = await make(900, 600, 'jpeg', { quality: 80 });
  const app2 = Buffer.concat([Buffer.from([0xFF, 0xE2, 0xFF, 0xFF]), Buffer.alloc(65533, 1)]);   // max segment length
  fs.writeFileSync(path.join(dir, 'e.jpg'), Buffer.concat([base.subarray(0, 2), app2, base.subarray(2)]));
  assert.deepStrictEqual(imageSize(path.join(dir, 'a.jpg')), { width: 1280, height: 960 });
  assert.deepStrictEqual(imageSize(path.join(dir, 'b.png')), { width: 321, height: 123 });
  assert.deepStrictEqual(imageSize(path.join(dir, 'c.webp')), { width: 640, height: 480 });
  assert.deepStrictEqual(imageSize(path.join(dir, 'd.webp')), { width: 64, height: 48 });
  assert.deepStrictEqual(imageSize(path.join(dir, 'e.jpg')), { width: 900, height: 600 });
});

test('unknown or missing files give null, and a changed file is re-read', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'x.txt'), 'not an image at all, just some text');
  assert.strictEqual(imageSize(path.join(dir, 'x.txt')), null);
  assert.strictEqual(imageSize(path.join(dir, 'missing.jpg')), null);
  const f = path.join(dir, 'f.jpg');
  fs.writeFileSync(f, await make(100, 50, 'jpeg'));
  assert.deepStrictEqual(imageSize(f), { width: 100, height: 50 });
  await new Promise(r => setTimeout(r, 20));
  fs.writeFileSync(f, await make(200, 80, 'jpeg'));
  const t = new Date(Date.now() + 5000); fs.utimesSync(f, t, t);
  assert.deepStrictEqual(imageSize(f), { width: 200, height: 80 });
});

test('variant: resized copy in the format the browser accepts, cached, never enlarged', async () => {
  const pub = tmp(), cache = path.join(tmp(), 'img');
  fs.mkdirSync(path.join(pub, 'img', 'catalog'), { recursive: true });
  fs.writeFileSync(path.join(pub, 'img', 'catalog', 'p.jpg'), await make(1280, 960, 'jpeg', { quality: 85 }));
  const v = await Variants.variant(cache, pub, path.join('img', 'catalog', 'p.jpg'), 480, 'image/avif,image/webp,*/*');
  assert.ok(v && v.path.endsWith('p.jpg-w480.avif'), 'avif variant built');
  assert.strictEqual(v.type, 'image/avif');
  assert.deepStrictEqual(await sharp(v.path).metadata().then(m => [m.width, m.height]), [480, 360]);
  const st1 = fs.statSync(v.path).mtimeMs;
  const again = await Variants.variant(cache, pub, path.join('img', 'catalog', 'p.jpg'), 480, 'image/avif');
  assert.strictEqual(fs.statSync(again.path).mtimeMs, st1, 'second call reuses the cached file');
  const w = await Variants.variant(cache, pub, path.join('img', 'catalog', 'p.jpg'), 800, 'image/webp');
  assert.strictEqual(w.type, 'image/webp');
  const j = await Variants.variant(cache, pub, path.join('img', 'catalog', 'p.jpg'), 800, '*/*');
  assert.strictEqual(j.type, 'image/jpeg');
  assert.strictEqual(await Variants.variant(cache, pub, path.join('img', 'catalog', 'p.jpg'), 1280, 'image/avif'), null, 'same width as the source: serve the original');
  assert.strictEqual(await Variants.variant(cache, pub, path.join('img', 'catalog', 'p.jpg'), 999, 'image/avif'), null, 'width not in the list');
  assert.strictEqual(await Variants.variant(cache, pub, path.join('img', 'catalog', 'nope.jpg'), 480, 'image/avif'), null, 'missing source');
});
