// Submit + moderation in the admin group (SPEC §6.5, §6.6).
const test = require('node:test');
const assert = require('node:assert');
const { makeImage, USER, GROUP } = require('./helpers');

const { modSetup, readyCar } = require('./flows');

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

test('approve publishes at once: status, log, site rebuild, partner notified, card updated', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');

  await s.groupTap('Одобрить');
  const c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'APPROVED');
  assert.ok(c.approvedAt);
  assert.strictEqual(c.en, null, 'no translation any more');
  assert.strictEqual(s.changed.length, 1, 'site data rebuilt once');
  assert.deepStrictEqual(s.cars.moderationLog(car.id).map(r => r.action), ['APPROVE']);
  assert.match(partnerTexts(s).at(-1), /Ваше авто Toyota Camry 2019 опубликовано на сайте/);

  const edits = s.calls.filter(x => x.method === 'editMessageText' && x.payload.chat_id === GROUP);
  assert.ok(edits.some(e => e.payload.message_id === c.modMessageId && /Одобрено и опубликовано: @owner/.test(e.payload.text)));
  assert.ok(!s.groupTexts().some(t => /Перевод/.test(t)));
});

test('someone else in the group cannot moderate; double clicks are harmless', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');

  await s.groupTap('Одобрить', { id: 42, is_bot: false, first_name: 'Guest' });
  assert.strictEqual(s.lastAnswer(), 'Нет доступа');
  assert.strictEqual(s.cars.moderationLog(car.id).length, 0);

  await s.groupTap('Одобрить');
  const modIdx = s.calls.filter(x => x.method === 'answerCallbackQuery').length;
  await s.bot.handleUpdate({ update_id: 9999, callback_query: { id: 'x', from: { id: 913187557, is_bot: false, first_name: 'Owner' }, chat_instance: '2', data: `mod:ok:${car.id}`, message: { message_id: 1, date: 0, chat: { id: GROUP, type: 'supergroup', title: 'M' }, text: 'x' } } });
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
