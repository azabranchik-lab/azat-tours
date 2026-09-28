// End-to-end registration/profile flow through the real grammY bot, with the
// Telegram API faked (no network, no token) and an in-memory SQLite DB.
const test = require('node:test');
const assert = require('node:assert');
const db = require('../../partners/db');
const { createStore } = require('../../partners/store');
const { createBot } = require('../../partners/bot/bot');

const OWNER = 913187557;
const USER = 5550001;

function setup(existingStore) {
  const store = existingStore || createStore(db.open(":memory:"));
  const cfg = {
    token: '1:fake', adminIds: [OWNER], adminChatId: 0, commissionPercent: 15, offerVersion: '2026-09',
    supportWhatsapp: '+996502888001', photoMaxMb: 10, minFreeDiskGb: 3, siteUrl: 'https://azattours.com'
  };
  const bot = createBot({ cfg, store });
  bot.botInfo = { id: 1, is_bot: true, first_name: 'Partners', username: 'partners_test_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false };
  const calls = [];
  bot.api.config.use(async (prev, method, payload) => {
    calls.push({ method, payload });
    return { ok: true, result: method === 'sendMessage' ? { message_id: calls.length, date: 0, chat: { id: payload.chat_id, type: 'private' }, text: payload.text } : true };
  });
  let uid = 1;
  const from = (id = USER) => ({ id, is_bot: false, first_name: 'Test', username: 'tester' });
  const chat = (id = USER) => ({ id, type: 'private', first_name: 'Test' });
  const send = (text, id) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(id), from: from(id), text, ...(text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } : {}) } });
  const contact = (phone, userId = USER) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(), from: from(), contact: { phone_number: phone, first_name: 'Test', user_id: userId } } });
  const press = data => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: from(), chat_instance: '1', data, message: { message_id: 1, date: 0, chat: chat(), text: 'x' } } });
  const lastText = () => [...calls].reverse().find(c => c.method === 'sendMessage').payload.text;
  const texts = () => calls.filter(c => c.method === 'sendMessage').map(c => c.payload.text);
  return { store, calls, send, contact, press, lastText, texts };
}

test('registration: name, phone, city, offer → menu; /start resumes the current step', async () => {
  const s = setup();
  await s.send('/start');
  assert.match(s.texts()[0], /Здравствуйте/);
  assert.match(s.lastText(), /имя или название компании/);

  await s.send('A');                            // too short
  assert.match(s.lastText(), /от 2 до 100/);
  await s.send('Ош Авто Прокат');
  assert.match(s.lastText(), /номер телефона/);

  await s.contact('+77010000000', 999);          // someone else's contact
  assert.match(s.lastText(), /только свой номер/);
  await s.contact('996555123456');               // own contact, no +
  assert.match(s.lastText(), /В каком городе/);

  // /start mid-registration resumes the same step instead of restarting.
  await s.send('/start');
  assert.match(s.lastText(), /В каком городе/);

  await s.send('Другой город');
  assert.match(s.lastText(), /название города/);
  await s.send('Талас');
  assert.match(s.lastText(), /^Условия:/);
  assert.match(s.lastText(), /15%/);

  await s.send('ок');                            // typing instead of pressing "Принимаю"
  assert.match(s.lastText(), /^Условия:/);

  await s.press('reg:accept');
  assert.match(s.lastText(), /зарегистрированы/);

  const p = s.store.getByTelegramId(USER);
  assert.strictEqual(p.name, 'Ош Авто Прокат');
  assert.strictEqual(p.phone, '+996555123456');
  assert.strictEqual(p.city, 'Талас');
  assert.strictEqual(p.offerVersion, '2026-09');
  assert.ok(p.offerAcceptedAt);
  assert.strictEqual(p.state, null);

  // Second press of the old accept button is harmless.
  await s.press('reg:accept');
  const answer = [...s.calls].reverse().find(c => c.method === 'answerCallbackQuery');
  assert.match(answer.payload.text, /неактуальна/);

  // Registered user: /start → menu straight away.
  await s.send('/start');
  assert.match(s.lastText(), /Выберите действие/);
});

test('profile: edit phone by text, menu tap cancels an edit', async () => {
  const s = setup();
  await s.send('/start'); await s.send('Азамат'); await s.send('0555 111 222'); await s.send('Бишкек');
  await s.press('reg:accept');

  await s.send('Профиль');
  assert.match(s.lastText(), /Телефон: \+996555111222/);

  await s.press('prof:phone');
  await s.send('+996 700 000 001');
  assert.ok(s.texts().includes('Сохранено.'));
  assert.match(s.lastText(), /Телефон: \+996700000001/);

  await s.press('prof:name');
  await s.send('Помощь');                         // menu button wins, edit abandoned
  assert.match(s.lastText(), /WhatsApp: \+996502888001/);
  assert.strictEqual(s.store.getByTelegramId(USER).name, 'Азамат');
  assert.strictEqual(s.store.getByTelegramId(USER).state, null);
});

test('blocked partner gets only the blocked message', async () => {
  const s = setup();
  await s.send('/start');
  const p = s.store.getByTelegramId(USER);
  s.store.update(p.id, { status: 'BLOCKED' });
  await s.send('Привет');
  assert.match(s.lastText(), /заблокирован/);
});

test('rate limit: more than 30 updates a minute are dropped', async () => {
  const s = setup();
  for (let i = 0; i < 35; i++) await s.send('/start');
  const tooFast = s.texts().filter(x => /Слишком много/.test(x));
  assert.strictEqual(tooFast.length, 1);
  // 30 handled: the first /start sends welcome + question (2), the other 29 re-ask (1 each); +1 warning.
  assert.strictEqual(s.calls.filter(c => c.method === 'sendMessage').length, 2 + 29 + 1);
});

test('restart mid-registration: a new bot on the same DB continues the same step', async () => {
  const s1 = setup();
  await s1.send('/start'); await s1.send('Азамат');
  const s2 = setup(s1.store);                     // "process restarted": fresh bot, same database
  await s2.send('0555 111 222');
  assert.match(s2.lastText(), /В каком городе/);
  assert.strictEqual(s2.store.getByTelegramId(USER).phone, '+996555111222');
});
