// lib/images.js: light copies of bot photos, never losing a photo.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const Images = require('../lib/images');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'azat-img-'));
const jpeg = (w, h, opts = {}) => {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: '#6a8f4e' } });
  if (opts.exif) img = img.withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'test' } } });
  return img.jpeg({ quality: 90 }).toBuffer();
};

test('a big camera photo is resized, gets a preview and WebP copies, loses EXIF', async () => {
  const dir = tmp();
  const out = await Images.save(await jpeg(4000, 3000, { exif: true }), path.join(dir, 'car-1'), '.jpg');
  assert.deepStrictEqual(out, { file: 'car-1.jpg', degraded: false });
  for (const f of ['car-1.jpg', 'car-1.jpg.webp', 'car-1-t.jpg', 'car-1-t.jpg.webp']) assert.ok(fs.existsSync(path.join(dir, f)), f);
  const main = await sharp(path.join(dir, 'car-1.jpg')).metadata();
  const thumb = await sharp(path.join(dir, 'car-1-t.jpg')).metadata();
  // orientation 6 = rotated: the stored file is upright (portrait) and capped at 1600
  assert.strictEqual(Math.max(main.width, main.height), 1600);
  assert.ok(main.height > main.width);
  assert.strictEqual(Math.max(thumb.width, thumb.height), 480);
  assert.strictEqual(main.exif, undefined);
  assert.strictEqual((await sharp(path.join(dir, 'car-1.jpg.webp')).metadata()).format, 'webp');
});

test('a Telegram-sized photo is kept byte for byte (no quality loss)', async () => {
  const dir = tmp();
  const buf = await jpeg(1280, 960);
  await Images.save(buf, path.join(dir, 'tg'), '.jpg');
  assert.ok(fs.readFileSync(path.join(dir, 'tg.jpg')).equals(buf));
  assert.ok(fs.existsSync(path.join(dir, 'tg-t.jpg.webp')));
});

test('a broken file is still saved as sent', async () => {
  const dir = tmp();
  const out = await Images.save(Buffer.from('not an image'), path.join(dir, 'bad'), '.jpg');
  assert.deepStrictEqual(out, { file: 'bad.jpg', degraded: true });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'bad.jpg'), 'utf8'), 'not an image');
  assert.ok(fs.existsSync(path.join(dir, 'bad-t.jpg')));
  assert.ok(!fs.existsSync(path.join(dir, 'bad.jpg.webp')));
});

test('without sharp the original bytes and extension are kept', async () => {
  const dir = tmp();
  Images._setSharp(null);
  try {
    const out = await Images.save(Buffer.from('png bytes'), path.join(dir, 'p'), '.png');
    assert.deepStrictEqual(out, { file: 'p.png', degraded: true });
    assert.ok(fs.existsSync(path.join(dir, 'p-t.png')));
  } finally { Images._setSharp(sharp); }
});

test('photos sent at the same moment are processed one by one, all saved', async () => {
  const dir = tmp();
  const bufs = await Promise.all([1, 2, 3, 4].map(() => jpeg(2000, 1500)));
  const outs = await Promise.all(bufs.map((b, i) => Images.save(b, path.join(dir, 'a' + i), '.jpg')));
  assert.ok(outs.every(o => !o.degraded));
  assert.strictEqual(fs.readdirSync(dir).length, 16);
});

test('remove deletes the photo and every copy', async () => {
  const dir = tmp();
  await Images.save(await jpeg(2000, 1500), path.join(dir, 'x'), '.jpg');
  Images.remove(path.join(dir, 'x.jpg'));
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});
