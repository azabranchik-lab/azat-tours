// Photos (SPEC §6.4): checks, processing, album, replace, plate choice, disk guard, cleanup.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const P = require('../lib/photos');
const { runCleanup } = require('../cleanup');
const { setup, makeImage, USER } = require('./helpers');

// Registers and walks the wizard up to the photo step.
async function toPhotos(s, plate = 'Сниму так, чтобы номера не было видно') {
  await s.register();
  await s.send('Добавить авто');
  await s.tap('Kia'); await s.send('Sportage'); await s.send('2020');
  await s.tap('Кроссовер'); await s.tap('Автомат'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  await s.send('серый'); await s.send('01KG 555 BBB'); await s.tap('Пропустить');
  await s.tap('Готово');
  await s.send('Экономичный кроссовер для города и трассы, всё обслужено.');
  await s.tap('С водителем'); await s.tap('Готово'); await s.send('5000');
  await s.tap('Пропустить'); await s.tap('Пропустить');
  await s.tap('КАСКО'); await s.tap('Да, бесплатно'); await s.tap('Пропустить');
  await s.tap('Только летом (июнь-сентябрь)');
  await s.tap(plate);
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

test('one by one: 8 angles in order with the plate hint on front/back, then extras', async () => {
  const s = setup();
  const car = await toPhotos(s);
  assert.match(s.texts().at(-2), /Теперь фото/);
  assert.match(s.lastText(), /Фото 1\/8: спереди\nНомер не должен попасть в кадр/);
  await s.sendPhoto();
  assert.match(s.texts().at(-2), /Принято: спереди/);
  assert.match(s.lastText(), /Фото 2\/8: сзади\nНомер не должен/);
  await s.sendPhoto();
  assert.match(s.lastText(), /^Фото 3\/8: слева$/);            // no plate hint on the sides
  await s.sendPhotos(6);
  assert.match(s.lastText(), /Дополнительные фото \(до 5\).*Сейчас: 0/s);
  await s.sendPhotos(2);
  assert.match(s.lastText(), /Сейчас: 2/);

  const photos = s.cars.photos(car.id);
  assert.deepStrictEqual(photos.map(p => p.angle), [...P.REQUIRED_ANGLES, 'EXTRA', 'EXTRA']);
  assert.strictEqual(fs.readdirSync(carDir(s, car)).length, 20); // main + thumb each
  assert.ok(photos.every(p => p.path.endsWith('.webp') && p.thumbPath.endsWith('-thumb.webp')));

  await s.tap('Готово');
  assert.match(s.lastText(), /^Проверьте анкету/);
  assert.ok(s.calls.some(c => c.method === 'sendMediaGroup'), 'album sent with the summary');
});

test('«Готово» before all 8 angles lists what is missing', async () => {
  const s = setup();
  await toPhotos(s);
  await s.sendPhotos(3);
  const idx = require('../bot/carWizard/steps').step('photos').index;
  await s.press(`w:${idx}:d`);                                 // e.g. an old «Готово» button
  assert.match(s.lastAnswer(), /^Нужны ещё фото: справа, салон/);
});

test('album of 10: 8 angles + 2 extras, one reply for the whole album', async () => {
  const s = setup(undefined, { albumDebounceMs: 300 });   // photos arrive back to back, like a real album
  const car = await toPhotos(s);
  const before = s.texts().length;
  await s.sendPhotos(10, { groupId: 'album1', buf: await makeImage() });
  assert.strictEqual(s.texts().length, before, 'no reply per album photo');
  await require('../bot/carWizard/photos').flushAlbums();
  const replies = s.texts().slice(before);
  assert.strictEqual(replies.length, 2);
  assert.match(replies[0], /^Принято: спереди, сзади, слева, справа, салон: передние сиденья и панель, салон: задние сиденья, багажник, приборная панель с пробегом, дополнительное, дополнительное$/);
  assert.match(replies[1], /Сейчас: 2/);
  assert.strictEqual(s.cars.photos(car.id).length, 10);
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
  assert.match(s2.lastText(), /Фото 2\/8/);                    // PNG file accepted
  assert.strictEqual(s2.cars.photos(car.id).length, 1);
});

test('replace one angle from the summary: old files deleted, back to summary', async () => {
  const s = setup();
  const car = await toPhotos(s);
  await s.sendPhotos(8);
  await s.tap('Готово');
  const oldLeft = s.cars.photos(car.id).find(p => p.angle === 'LEFT');

  await s.tap('Изменить');
  await s.tap('Фото');
  await s.tap('слева');
  assert.match(s.lastText(), /Отправьте новое фото: слева/);
  await s.sendPhoto();
  assert.ok(s.texts().includes('Фото заменено.'));
  assert.match(s.lastText(), /^Проверьте анкету/);

  const photos = s.cars.photos(car.id);
  assert.strictEqual(photos.length, 8);
  const newLeft = photos.find(p => p.angle === 'LEFT');
  assert.notStrictEqual(newLeft.id, oldLeft.id);
  assert.ok(!fs.existsSync(path.join(s.storage.root, oldLeft.path)));
  assert.ok(fs.existsSync(path.join(s.storage.root, newLeft.path)));
});

test('delete draft removes its photo folder', async () => {
  const s = setup();
  const car = await toPhotos(s);
  await s.sendPhotos(8);
  await s.tap('Готово');
  assert.ok(fs.existsSync(carDir(s, car)));
  await s.tap('Удалить черновик');
  await s.tap('Да, удалить');
  assert.ok(!fs.existsSync(carDir(s, car)));
  assert.deepStrictEqual(s.cars.photos(car.id), []);
});

test('plate choice: stored, and offered first next time', async () => {
  const s = setup();
  const car = await toPhotos(s, 'Замажьте номер за меня');
  assert.strictEqual(s.cars.get(car.id).plateOnPhotos, 'BLUR');
  assert.match(s.lastText(), /^Фото 1\/8: спереди$/);           // no "hide it yourself" hint for BLUR
  await s.sendPhotos(8); await s.tap('Готово');
  s.cars.update(car.id, { status: 'PENDING' });

  await s.send('Добавить авто');
  await s.tap('Новое авто');
  await s.tap('Kia'); await s.send('Rio'); await s.send('2018');
  await s.tap('Седан'); await s.tap('Автомат'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  await s.send('белый'); await s.send('01KG 111 CCC'); await s.tap('Пропустить'); await s.tap('Готово');
  await s.send('Надёжный седан для города, чистый салон, свежее ТО.');
  await s.tap('С водителем'); await s.tap('Готово'); await s.send('3000');
  await s.tap('Пропустить'); await s.tap('Пропустить');
  await s.tap('КАСКО'); await s.tap('Да, бесплатно'); await s.tap('Пропустить');
  await s.tap('Круглый год');
  assert.match(s.lastText(), /В прошлый раз вы выбрали: Замажьте номер за меня/);
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
  await s.sendPhotos(8); await s.tap('Готово');
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
