// The runner delivers updates concurrently; sequentialize() in bot.js must keep
// each user's updates in order while different users proceed in parallel.
const test = require('node:test');
const assert = require('node:assert');
const { makeImage, USER } = require('./helpers');
const { modSetup, readyCar, specs, insDelivery } = require('./flows');
const photos = require('../bot/carWizard/photos');
const P = require('../lib/photos');

test('an album of 10 delivered all at once: 6 photos kept in order, one message about the rest', async () => {
  const s = modSetup({ albumDebounceMs: 200 });
  const car = await readyCar(s);                     // already has photos → go on with a fresh car
  await s.tap('Удалить черновик'); await s.tap('Да, удалить');
  await s.send('Добавить авто');
  await s.send('Kia Rio 2018');
  await specs(s);
  await s.send('01KG 999 ZZZ'); await s.tap('Готово');
  await s.send('Экономичный седан для города, свежее ТО, чистый салон.');
  await s.tap('С водителем'); await s.send('3000');
  await s.tap('Пропустить'); await insDelivery(s, 'КАСКО', 'Да, бесплатно');
  await s.tap('Пропустить');

  const buf = await makeImage();
  await Promise.all(Array.from({ length: 10 }, () => s.sendPhoto({ groupId: 'burst', buf })));   // concurrent
  await photos.flushAlbums();
  const draft = s.cars.latestDraft(s.store.getByTelegramId(USER).id);
  const got = s.cars.photos(draft.id);
  assert.deepStrictEqual(got.map(p => p.sortOrder), [0, 1, 2, 3, 4, 5]);
  assert.strictEqual(got.length, P.MAX_PHOTOS);
  assert.ok(s.texts().some(t => /лишние \(4\) не сохранили/.test(t)));
  assert.match(s.lastText(), /^Проверьте анкету/);
  assert.ok(car);
});

test('two partners registering at the same time do not mix their answers', async () => {
  const s = modSetup();
  const other = 777001;
  const msg = (id, text) => s.bot.handleUpdate({ update_id: Math.floor(Math.random() * 1e9), message: {
    message_id: 1, date: 0, text, chat: { id, type: 'private', first_name: 'P' }, from: { id, is_bot: false, first_name: 'P' },
    ...(text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.length }] } : {})
  } });
  await Promise.all([msg(USER, '/start'), msg(other, '/start')]);
  await Promise.all([msg(USER, 'Первый Партнёр'), msg(other, 'Второй Партнёр')]);
  await Promise.all([msg(USER, '0555 000 001'), msg(other, '0700 000 002')]);
  assert.strictEqual(s.store.getByTelegramId(USER).name, 'Первый Партнёр');
  assert.strictEqual(s.store.getByTelegramId(other).name, 'Второй Партнёр');
  assert.strictEqual(s.store.getByTelegramId(USER).phone, '+996555000001');
  assert.strictEqual(s.store.getByTelegramId(other).phone, '+996700000002');
});
