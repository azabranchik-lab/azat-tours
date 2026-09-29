// Admin panel in the moderation group (SPEC §6.10; owner's choice: group only).
const test = require('node:test');
const assert = require('node:assert');
const { USER, OWNER, GROUP } = require('./helpers');
const { modSetup, readyCar, publishedCar } = require('./flows');

let uid = 50000;
function groupCmd(s, text, { from = OWNER, chat = GROUP } = {}) {
  const cmd = text.split(' ')[0];
  return s.bot.handleUpdate({ update_id: uid++, message: {
    message_id: uid, date: 0, text, entities: [{ type: 'bot_command', offset: 0, length: cmd.length }],
    chat: { id: chat, type: 'supergroup', title: 'G' }, from: { id: from, is_bot: false, first_name: 'X', username: from === OWNER ? 'owner' : 'x' }
  } });
}
const groupReplies = s => s.calls.filter(c => c.method === 'sendMessage' && c.payload.chat_id === GROUP).map(c => c.payload.text);

test('/panel: counts, buttons, tries to pin; strangers and other groups get nothing', async () => {
  const s = modSetup();
  await publishedCar(s);
  await groupCmd(s, '/panel');
  const panel = groupReplies(s).at(-1);
  assert.match(panel, /^Панель управления\n\nНа проверке: 0\nОпубликовано: 1\nПартнёров: 1/);
  assert.ok(s.calls.some(c => c.method === 'pinChatMessage'));
  for (const label of ['На проверке', 'Статистика', 'Выгрузка CSV', 'Найти партнёра']) assert.ok(s.hasButton(label), label);

  const before = s.calls.length;
  await groupCmd(s, '/stats', { from: 12345 });            // not an admin: silence
  assert.strictEqual(s.calls.length, before);
  await groupCmd(s, '/stats', { chat: -100777 });          // admin, but another group
  assert.match(s.calls.at(-1).payload.text, /только в подключённой группе/);
});

test('pending list opens a fresh moderation card that works', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');
  await groupCmd(s, '/panel');
  await s.groupTap('На проверке');
  assert.match(groupReplies(s).at(-1), /^На проверке: 1/);
  await s.groupTap(`Toyota Camry 2019 · Ош Авто · только что`);
  assert.match(groupReplies(s).at(-1), new RegExp(`#car ${car.id}$`));
  await s.groupTap('Одобрить');
  await s.groupTap('Опубликовать');
  assert.strictEqual(s.cars.get(car.id).status, 'APPROVED');

  await groupCmd(s, '/pending');
  assert.strictEqual(groupReplies(s).at(-1), 'На проверке ничего нет.');
});

test('stats counts partners and cars by status', async () => {
  const s = modSetup();
  await publishedCar(s);
  await groupCmd(s, '/stats');
  const t = groupReplies(s).at(-1);
  assert.match(t, /Партнёров: 1 \(заблокировано: 0/);
  assert.match(t, /Опубликовано: 1/);
  assert.match(t, /Фото занимают: \d/);
});

test('export: two CSV files for Excel (BOM, ";"), with plate and photo links', async () => {
  const s = modSetup();
  const car = await publishedCar(s);
  await groupCmd(s, '/export');
  const docs = s.calls.filter(c => c.method === 'sendDocument');
  assert.strictEqual(docs.length, 2);
  const [partners, cars] = docs.map(d => d.payload.document.fileData.toString('utf8'));
  assert.ok(partners.startsWith('﻿Telegram ID;Username;Имя;Телефон'));
  assert.match(partners, new RegExp(`${USER};@tester;Ош Авто;\\+996555111222;Бишкек;ACTIVE`));
  assert.match(cars, /;01KG 123 ABC;/);
  assert.match(cars, new RegExp(`https://azattours.com/car-photos/${car.id}/FRONT-`));
  assert.match(docs[0].payload.document.filename, /^partners-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('find partner by phone (any format) or Telegram ID, then block and unblock', async () => {
  const s = modSetup();
  const car = await publishedCar(s);
  const rebuilt = s.changed.length;

  await groupCmd(s, '/partner 0555 111 222');
  assert.match(groupReplies(s).at(-1), /^Партнёр: Ош Авто\nТелефон: \+996555111222/);
  assert.match(groupReplies(s).at(-1), /Toyota Camry 2019 · Опубликовано/);

  await groupCmd(s, '/panel');
  await s.groupTap('Найти партнёра');
  await s.groupReply('#find', String(USER));
  assert.match(groupReplies(s).at(-1), new RegExp(`ID ${USER}`));

  await s.groupTap('Заблокировать');
  assert.match(groupReplies(s).at(-1), /Заблокировать Ош Авто\?/);
  await s.groupTap('Да, заблокировать');
  assert.strictEqual(s.store.getByTelegramId(USER).status, 'BLOCKED');
  assert.strictEqual(s.changed.length, rebuilt + 1, 'site rebuilt: their cars disappear');
  await s.send('Мои авто');
  assert.match(s.lastText(), /заблокирован/);

  await groupCmd(s, `/unblock ${USER}`);
  assert.strictEqual(s.store.getByTelegramId(USER).status, 'ACTIVE');
  await groupCmd(s, '/partner +7 000');
  assert.match(groupReplies(s).at(-1), /не найден/);
  assert.ok(car);
});

test('the owner cannot be blocked', async () => {
  const s = modSetup();
  s.store.getOrCreate(OWNER, 'owner');
  await groupCmd(s, `/block ${OWNER}`);
  assert.strictEqual(groupReplies(s).at(-1), 'Админа заблокировать нельзя.');
});

test('private chats never see admin commands', async () => {
  const s = modSetup();
  await s.register();
  await s.send('/panel');
  assert.doesNotMatch(s.lastText(), /Панель/);
  await s.send('/stats');
  assert.doesNotMatch(s.lastText(), /Статистика/);
});
