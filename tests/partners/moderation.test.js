// Submit + moderation in the admin group (SPEC §6.5, §6.6).
const test = require('node:test');
const assert = require('node:assert');
const { setup, makeImage, USER, GROUP } = require('./helpers');

const fakeTranslate = async fields => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, 'EN ' + v]));

function modSetup(extra = {}, deps = {}) {
  const changed = [];
  const s = setup(undefined, { adminChatId: GROUP, ...extra }, null, { translate: fakeTranslate, onCarsChanged: () => changed.push(1), ...deps });
  s.changed = changed;
  return s;
}

// Registered partner with a complete draft at the summary.
async function readyCar(s, plate = 'Замажьте номер за меня') {
  await s.register();
  await s.send('Добавить авто');
  await s.tap('Toyota'); await s.send('Camry'); await s.send('2019');
  await s.tap('Седан'); await s.tap('Автомат'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  await s.send('белый'); await s.send('01KG 123 ABC'); await s.send('80000');
  await s.tap('Кондиционер'); await s.tap('Готово');
  await s.send('Чистая ухоженная машина, для города и трассы.');
  await s.tap('Без водителя'); await s.tap('Готово'); await s.send('3500');
  await s.tap('Пропустить'); await s.send('10000');
  await s.tap('ОСАГО (обязательная)'); await s.tap('Да, за доплату');
  await s.send('от 25 лет'); await s.tap('Пропустить');
  await s.tap('Круглый год');
  await s.tap(plate);
  await s.sendPhotos(8, { buf: await makeImage() });
  await s.tap('Готово');
  return s.cars.latestDraft(s.store.getByTelegramId(USER).id);
}

const partnerTexts = s => s.calls.filter(c => c.method === 'sendMessage' && c.payload.chat_id === USER).map(c => c.payload.text);

test('submit: partner is told, the group gets the album and a full card', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');

  assert.match(partnerTexts(s).at(-1), /отправлено на проверку/);
  const c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'PENDING');
  assert.ok(c.submittedAt);
  assert.ok(c.modMessageId);
  assert.strictEqual(s.store.getByTelegramId(USER).state, null);

  const album = s.calls.find(x => x.method === 'sendMediaGroup' && x.payload.chat_id === GROUP);
  assert.ok(album, 'album sent to the group');
  assert.strictEqual(album.payload.media.length, 8);

  const card = s.groupTexts().at(-1);
  assert.match(card, /^На проверку: Toyota Camry 2019/);
  assert.match(card, /Партнёр: Ош Авто\nТелефон: \+996555111222\nTelegram: @tester/);
  assert.strictEqual(card.match(/Госномер: 01KG 123 ABC/g).length, 1);
  assert.strictEqual(card.match(/Toyota Camry 2019/g).length, 1);
  assert.match(card, /просит замазать номер/);
  assert.match(card, new RegExp(`#car ${car.id}$`));
});

test('approve → translation → publish: status, log, site rebuild, partner notified', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');

  await s.groupTap('Одобрить');
  const tr = s.groupTexts().at(-1);
  assert.match(tr, /^Перевод для сайта: Toyota Camry 2019/);
  assert.match(tr, /Описание:\nEN Чистая ухоженная машина/);
  assert.match(tr, /Цвет:\nEN белый/);
  assert.match(tr, /Требования к водителю:\nEN от 25 лет/);
  assert.ok(!/Ограничения/.test(tr), 'empty fields are not translated');
  assert.strictEqual(s.cars.get(car.id).status, 'PENDING', 'not public before «Опубликовать»');

  await s.groupTap('Опубликовать');
  const c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'APPROVED');
  assert.ok(c.approvedAt);
  assert.strictEqual(c.en.color, 'EN белый');
  assert.strictEqual(s.changed.length, 1, 'site data rebuilt once');
  assert.deepStrictEqual(s.cars.moderationLog(car.id).map(r => r.action), ['APPROVE', 'PUBLISH']);
  assert.match(partnerTexts(s).at(-1), /Ваше авто Toyota Camry 2019 опубликовано на сайте/);

  const edits = s.calls.filter(x => x.method === 'editMessageText' && x.payload.chat_id === GROUP);
  assert.ok(edits.some(e => e.payload.message_id === c.modMessageId && /Опубликовано: @owner/.test(e.payload.text)));
});

test('someone else in the group cannot moderate; double clicks are harmless', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');

  await s.groupTap('Одобрить', { id: 42, is_bot: false, first_name: 'Guest' });
  assert.strictEqual(s.lastAnswer(), 'Нет доступа');
  assert.strictEqual(s.cars.moderationLog(car.id).length, 0);

  await s.groupTap('Одобрить');
  await s.groupTap('Опубликовать');
  const modIdx = s.calls.filter(x => x.method === 'answerCallbackQuery').length;
  await s.bot.handleUpdate({ update_id: 9999, callback_query: { id: 'x', from: { id: 913187557, is_bot: false, first_name: 'Owner' }, chat_instance: '2', data: `mod:pub:${car.id}`, message: { message_id: 1, date: 0, chat: { id: GROUP, type: 'supergroup', title: 'M' }, text: 'x' } } });
  assert.strictEqual(s.lastAnswer(), 'Уже обработано');
  assert.ok(s.calls.filter(x => x.method === 'answerCallbackQuery').length > modIdx);
  assert.strictEqual(s.changed.length, 1);
});

test('reject with a reason → partner fixes and resubmits → card says "повторно"', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');

  await s.groupTap('Отклонить');
  assert.match(s.groupTexts().at(-1), /Напишите причину отклонения: Toyota Camry 2019/);
  await s.groupReply('#reason', 'ok');                   // too short
  assert.match(s.groupTexts().at(-1), /от 3 до 500/);
  await s.groupReply('#reason', 'На фото сзади виден номер');

  let c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'REJECTED');
  assert.strictEqual(c.rejectReason, 'На фото сзади виден номер');
  assert.match(partnerTexts(s).at(-1), /не прошло проверку\. Причина: На фото сзади виден номер/);
  assert.match(s.groupTexts().at(-1), /^Отклонено: @owner/);

  await s.tap('Исправить');
  assert.match(s.lastText(), /^Проверьте анкету/);
  await s.tap('Изменить'); await s.tap('Фото'); await s.tap('сзади');
  await s.sendPhoto({ buf: await makeImage() });
  await s.tap('Отправить на проверку');

  c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'PENDING');
  assert.match(s.groupTexts().at(-1), /^На проверку повторно: Toyota Camry 2019\nПрошлая причина отклонения: На фото сзади виден номер/);
  assert.deepStrictEqual(s.cars.moderationLog(car.id).map(r => r.action), ['REJECT']);
});

test('translation failure: admin types the translations, publish waits for all fields', async () => {
  const s = modSetup({}, { translate: async () => { throw new Error('no API key'); } });
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');
  await s.groupTap('Одобрить');
  assert.match(s.groupTexts().at(-1), /Автоперевод не получился \(no API key\)/);
  assert.match(s.groupTexts().at(-1), /Описание:\n\(нет перевода\)/);

  await s.groupTap('Опубликовать');
  assert.match(s.lastAnswer(), /^Нет перевода: Описание, Цвет, Требования к водителю, Когда свободно$/);
  assert.strictEqual(s.cars.get(car.id).status, 'PENDING');

  for (const [label, text] of [['Описание', 'Clean, well kept car for city and highway.'], ['Цвет', 'White'], ['Требования к водителю', 'Age 25+'], ['Когда свободно', 'All year']]) {
    await s.groupTap(`Изменить: ${label}`);
    await s.groupReply('#tr', text);
  }
  assert.match(s.groupTexts().at(-1), /Цвет:\nWhite/);
  await s.groupTap('Опубликовать');
  const c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'APPROVED');
  assert.deepStrictEqual(c.en, { description: 'Clean, well kept car for city and highway.', color: 'White', driverRequirements: 'Age 25+', availabilityNote: 'All year' });
});

test('admin replaces a photo (plate blurred) by replying with a picture', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');
  const oldBack = s.cars.photos(car.id).find(p => p.angle === 'BACK');

  await s.groupTap('Заменить фото');
  await s.groupTap('сзади');
  assert.match(s.groupTexts().at(-1), /Пришлите исправленное фото \(сзади\)/);
  await s.groupReply('#photo', { photo: await makeImage() });
  assert.match(s.groupTexts().at(-1), /Фото «сзади» заменено/);

  const photos = s.cars.photos(car.id);
  assert.strictEqual(photos.length, 8);
  assert.notStrictEqual(photos.find(p => p.angle === 'BACK').id, oldBack.id);
});

test('no admin group connected: submit still works, nothing is lost', async () => {
  const s = modSetup({ adminChatId: 0 });
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');
  assert.match(partnerTexts(s).at(-1), /отправлено на проверку/);
  assert.strictEqual(s.cars.get(car.id).status, 'PENDING');
  assert.strictEqual(s.groupTexts().length, 0);
});
