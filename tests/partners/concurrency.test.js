// The runner delivers updates concurrently; sequentialize() in bot.js must keep
// each user's updates in order while different users proceed in parallel.
const test = require('node:test');
const assert = require('node:assert');
const { makeImage, USER } = require('./helpers');
const { modSetup, readyCar } = require('./flows');
const photos = require('../../partners/bot/carWizard/photos');
const P = require('../../partners/lib/photos');

test('an album delivered all at once still fills the angles in order', async () => {
  const s = modSetup({ albumDebounceMs: 200 });
  const car = await readyCar(s);                     // already has 8 photos → go replace them via a fresh car
  await s.tap('Удалить черновик'); await s.tap('Да, удалить');
  await s.send('Добавить авто');
  const draftFlow = ['Kia', 'Rio'];
  await s.tap(draftFlow[0]); await s.send(draftFlow[1]); await s.send('2018');
  await s.tap('Седан'); await s.tap('Автомат'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  await s.tap('Пропустить'); await s.send('01KG 999 ZZZ'); await s.tap('Пропустить'); await s.tap('Готово');
  await s.send('Экономичный седан для города, свежее ТО, чистый салон.');
  await s.tap('С водителем'); await s.tap('Готово'); await s.send('3000');
  await s.tap('Пропустить'); await s.tap('Пропустить'); await s.tap('КАСКО'); await s.tap('Да, бесплатно');
  await s.tap('Пропустить'); await s.tap('Круглый год'); await s.tap('Номер можно показывать');

  const buf = await makeImage();
  await Promise.all(Array.from({ length: 10 }, () => s.sendPhoto({ groupId: 'burst', buf })));   // concurrent
  await photos.flushAlbums();
  const draft = s.cars.latestDraft(s.store.getByTelegramId(USER).id);
  const got = s.cars.photos(draft.id).map(p => p.angle);
  assert.deepStrictEqual(got, [...P.REQUIRED_ANGLES, 'EXTRA', 'EXTRA']);
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
