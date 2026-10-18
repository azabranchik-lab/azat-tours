// Photos (SPEC §6.4): checks, processing, 4 to 6 photos as an album, cover, disk guard, cleanup.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const P = require('../lib/photos');
const { runCleanup } = require('../cleanup');
const { setup, makeImage, USER } = require('./helpers');
const { specs, insDelivery } = require('./flows');

// Registers and walks the wizard up to the photo step.
async function toPhotos(s) {
  await s.register();
  await s.send('Добавить авто');
  await s.send('Kia Sportage 2020');
  await specs(s, 'Кроссовер');
  await s.send('5000');
  await s.tap('Пропустить');
  await insDelivery(s, 'Страховка КАСКО', 'Доставка бесплатно'); await s.tap('Пропустить');
  return s.cars.latestDraft(s.store.getByTelegramId(USER).id);
}

const carDir = (s, car) => path.join(s.storage.root, car.id);


test('checkIncoming: formats and size before download', () => {
  assert.deepStrictEqual(P.checkIncoming({ kind: 'photo', size: 1000 }, 10), { ok: true });
  assert.deepStrictEqual(P.checkIncoming({ kind: 'document', mime: 'image/png', fileName: 'a.png', size: 1000 }, 10), { ok: true });
  assert.deepStrictEqual(P.checkIncoming({ kind: 'document', mime: 'image/webp', fileName: 'a.webp' }, 10), { ok: true });
  assert.strictEqual(P.checkIncoming({ kind: 'document', mime: 'image/heic', fileName: 'IMG_1.HEIC' }, 10).error, 'photo_format');
  assert.strictEqual(P.checkIncoming({ kind: 'document', mime: 'image/jpeg', fileName: 'IMG_1.heic' }, 10).error, 'photo_format');
  assert.strictEqual(P.checkIncoming({ kind: 'document', mime: 'application/pdf', fileName: 'a.pdf' }, 10).error, 'photo_format');
  assert.strictEqual(P.checkIncoming({ kind: 'document', mime: 'image/gif', fileName: 'a.gif' }, 10).error, 'photo_format');
  assert.strictEqual(P.checkIncoming({ kind: 'photo', size: 11 * 1024 * 1024 }, 10).error, 'photo_too_big');
});

test('processImage: WebP output, resized, no EXIF, real format checked', async () => {
  const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#335577' } })
    .jpeg().withMetadata({ exif: { IFD0: { Copyright: 'secret GPS owner' } } }).toBuffer();
  assert.ok((await sharp(big).metadata()).exif, 'input has EXIF');
  const r = await P.processImage(big);
  assert.ok(r.ok);
  const meta = await sharp(r.main).metadata();
  assert.strictEqual(meta.format, 'webp');
  assert.strictEqual(Math.max(meta.width, meta.height), 1600);
  assert.strictEqual(meta.exif, undefined);
  assert.ok(r.main.length < 1024 * 1024);
  assert.strictEqual((await sharp(r.thumb).metadata()).width, 480);

  assert.strictEqual((await P.processImage(await makeImage(800, 500))).error, 'photo_small');
  assert.strictEqual((await P.processImage(await makeImage(1200, 900, 'gif'))).error, 'photo_format');
  assert.strictEqual((await P.processImage(Buffer.from('not an image'))).error, 'photo_format');
  assert.ok((await P.processImage(await makeImage(1200, 900, 'png'))).ok);
});

test('one by one: «Готово» appears from 4 photos, the 6th goes straight to the summary', async () => {
  const s = setup();
  const car = await toPhotos(s);
  assert.match(s.lastText(), /^Шаг 7 из 7\nФото: выберите в галерее сразу от 4 до 6 снимков/);
  assert.match(s.lastText(), /не закрашивайте и не прячьте/);
  assert.ok(!s.hasButton('Готово'));
  await s.sendPhoto();
  assert.match(s.lastText(), /^Принято фото: 1\. Нужно ещё хотя бы 3\.$/);
  await s.sendPhotos(3);
  assert.match(s.lastText(), /^Принято фото: 4 из 6\. Можно отправить ещё 2 или нажать «Готово»\.$/);
  assert.ok(s.hasButton('Готово'));
  await s.sendPhotos(2);
  assert.match(s.lastText(), /^Проверьте анкету/);
  assert.match(s.lastText(), /Фото: 6, главное первое/);
  assert.ok(s.calls.some(c => c.method === 'sendMediaGroup'), 'album sent with the summary');

  const photos = s.cars.photos(car.id);
  assert.deepStrictEqual(photos.map(p => p.angle), Array(6).fill('EXTRA'));
  assert.deepStrictEqual(photos.map(p => p.sortOrder), [0, 1, 2, 3, 4, 5]);
  assert.strictEqual(fs.readdirSync(carDir(s, car)).length, 12); // main + thumb each
  assert.ok(photos.every(p => p.path.endsWith('.webp') && p.thumbPath.endsWith('-thumb.webp')));
});

test('«Готово» with fewer than 4 photos says how many are missing', async () => {
  const s = setup();
  await toPhotos(s);
  await s.sendPhotos(2);
  const idx = require('../bot/carWizard/steps').step('photos').index;
  await s.press(`w:${idx}:d`);                                 // e.g. an old «Готово» button
  assert.match(s.lastAnswer(), /^Нужно ещё фото: хотя бы 2\./);
});

test('album of 5: one reply for the whole album, then «Готово»', async () => {
  const s = setup(undefined, { albumDebounceMs: 300 });   // photos arrive back to back, like a real album
  const car = await toPhotos(s);
  const before = s.texts().length;
  await s.sendPhotos(5, { groupId: 'album1', buf: await makeImage() });
  assert.strictEqual(s.texts().length, before, 'no reply per album photo');
  await require('../bot/carWizard/photos').flushAlbums();
  const replies = s.texts().slice(before);
  assert.deepStrictEqual(replies, ['Принято фото: 5 из 6. Можно отправить ещё 1 или нажать «Готово».']);
  assert.strictEqual(s.cars.photos(car.id).length, 5);
  await s.tap('Готово');
  assert.match(s.lastText(), /^Проверьте анкету/);
});

test('a single photo after 6 is refused', async () => {
  const s = setup();
  const car = await toPhotos(s);
  await s.sendPhotos(6);
  const st = s.store.getByTelegramId(USER).state;
  s.store.setState(s.store.getByTelegramId(USER).id, { ...st, step: 'photos' });   // still on the photo step
  await s.sendPhoto();
  assert.match(s.lastText(), /Уже 6 фото, больше не нужно/);
  assert.strictEqual(s.cars.photos(car.id).length, 6);
});

test('rejected inputs: HEIC file, huge file, small photo, photo at the wrong step', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.sendPhoto();
  assert.match(s.lastText(), /Сейчас нужен ответ на вопрос выше/);

  const s2 = setup();
  const car = await toPhotos(s2);
  await s2.sendPhoto({ document: { mime: 'image/heic', name: 'IMG_0001.HEIC' } });
  assert.match(s2.lastText(), /формат не подходит/);
  await s2.sendPhoto({ document: { mime: 'image/jpeg', name: 'big.jpg', size: 25 * 1024 * 1024 } });
  assert.match(s2.lastText(), /Файл больше 10 МБ/);
  await s2.sendPhoto({ buf: await makeImage(700, 400) });
  assert.match(s2.lastText(), /слишком маленькое/);
  await s2.sendPhoto({ document: { mime: 'image/png', name: 'front.png' }, buf: await makeImage(1200, 900, 'png') });
  assert.match(s2.lastText(), /Принято фото: 1/);              // PNG file accepted
  assert.strictEqual(s2.cars.photos(car.id).length, 1);
});

test('summary: choose the cover, add a photo, upload all again', async () => {
  const s = setup();
  const car = await toPhotos(s);
  await s.sendPhotos(4);
  await s.tap('Готово');
  const before = s.cars.photos(car.id);

  await s.tap('Изменить');
  await s.tap('Фото');
  await s.tap('Выбрать главное фото');
  await s.tap('3');
  assert.ok(s.texts().includes('Главным стало фото 3.'));
  assert.match(s.lastText(), /^Проверьте анкету/);
  assert.deepStrictEqual(s.cars.photos(car.id).map(p => p.id), [before[2], before[0], before[1], before[3]].map(p => p.id));

  await s.tap('Изменить');
  await s.tap('Фото');
  await s.tap('Добавить фото');
  await s.sendPhoto();
  assert.match(s.lastText(), /Принято фото: 5 из 6/);
  await s.tap('Готово');
  assert.strictEqual(s.cars.photos(car.id).length, 5);

  await s.tap('Изменить');
  await s.tap('Фото');
  await s.tap('Загрузить фото заново');
  assert.match(s.lastText(), /^Фото: выберите в галерее/);
  assert.deepStrictEqual(s.cars.photos(car.id), []);
  for (const p of before) assert.ok(!fs.existsSync(path.join(s.storage.root, p.path)));
  await s.sendPhotos(4);
  await s.tap('Готово');
  assert.match(s.lastText(), /^Проверьте анкету/);
  assert.strictEqual(s.cars.photos(car.id).length, 4);
});

test('cover choice also works for a car with the old angle photos', async () => {
  const s = setup();
  const car = await toPhotos(s);
  for (const angle of ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'INTERIOR_FRONT']) {
    s.cars.addPhoto(car.id, { angle, telegramFileId: 'f', telegramFileUniqueId: 'u', path: `${car.id}/${angle}.webp`, thumbPath: `${car.id}/${angle}-t.webp`, width: 1, height: 1 });
  }
  const old = s.cars.photos(car.id);
  s.cars.setPhotoOrder(car.id, [old[4].id, old[0].id, old[1].id, old[2].id, old[3].id]);
  const now = s.cars.photos(car.id);
  assert.strictEqual(now[0].id, old[4].id);
  assert.ok(now.every(p => p.angle === 'EXTRA'));
});

test('delete draft removes its photo folder', async () => {
  const s = setup();
  const car = await toPhotos(s);
  await s.sendPhotos(4);
  await s.tap('Готово');
  assert.ok(fs.existsSync(carDir(s, car)));
  await s.tap('Удалить черновик');
  await s.tap('Да, удалить');
  assert.ok(!fs.existsSync(carDir(s, car)));
  assert.deepStrictEqual(s.cars.photos(car.id), []);
});

test('the plate is not asked: the photo step asks to keep it visible, hiding it on the site is on request', async () => {
  const s = setup();
  const car = await toPhotos(s);
  const c = s.cars.get(car.id);
  assert.strictEqual(c.plateOnPhotos, null);
  assert.strictEqual(c.plateNumber, null);
  assert.ok(!s.texts().some(t => /Госномер\?/.test(t)));
  assert.match(s.lastText(), /Госномер, пожалуйста, не закрашивайте/);
});

test('low disk: photos refused, partner gets a calm message', async () => {
  const s = setup();
  const car = await toPhotos(s);
  s.storage.freeBytes = () => 1024; // almost full
  await s.sendPhoto();
  assert.match(s.lastText(), /не можем принять фото/);
  assert.strictEqual(s.cars.photos(car.id).length, 0);
});

test('cleanup: archived photos after 30 days, drafts after 90 days', async () => {
  const s = setup();
  const car = await toPhotos(s);
  await s.sendPhotos(4); await s.tap('Готово');
  const day = 24 * 60 * 60 * 1000;

  // Fresh: nothing to do.
  let r = await runCleanup(s.conn, s.storage);
  assert.deepStrictEqual([r.archivedCleared, r.draftsDeleted], [0, 0]);

  // Draft untouched for 91 days → deleted with its photos.
  r = await runCleanup(s.conn, s.storage, Date.now() + 91 * day);
  assert.strictEqual(r.draftsDeleted, 1);
  assert.strictEqual(s.cars.get(car.id), null);
  assert.ok(!fs.existsSync(carDir(s, car)));

  // Archived car: photos go after 30 days, the car row stays.
  const arch = s.cars.create(s.store.getByTelegramId(USER).id, { status: 'ARCHIVED', make: 'Kia' });
  await s.storage.save(`${arch.id}/FRONT-x.webp`, Buffer.from('x'));
  s.cars.addPhoto(arch.id, { angle: 'FRONT', telegramFileId: 'f', telegramFileUniqueId: 'u', path: `${arch.id}/FRONT-x.webp`, thumbPath: `${arch.id}/FRONT-x-thumb.webp`, width: 1, height: 1 });
  r = await runCleanup(s.conn, s.storage, Date.now() + 29 * day);
  assert.strictEqual(r.archivedCleared, 0);
  r = await runCleanup(s.conn, s.storage, Date.now() + 31 * day);
  assert.strictEqual(r.archivedCleared, 1);
  assert.ok(s.cars.get(arch.id));
  assert.deepStrictEqual(s.cars.photos(arch.id), []);
  assert.ok(!fs.existsSync(path.join(s.storage.root, arch.id)));
});
