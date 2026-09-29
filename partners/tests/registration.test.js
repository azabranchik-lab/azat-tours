// End-to-end registration/profile flow through the real grammY bot, with the
// Telegram API faked (no network, no token) and an in-memory SQLite DB.
const test = require('node:test');
const assert = require('node:assert');
const { setup, USER } = require('./helpers');

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

test('rate limit: more than 30 updates a minute are dropped (limit set to 30)', async () => {
  const s = setup(undefined, { rateLimitPerMin: 30 });
  for (let i = 0; i < 35; i++) await s.send('/start');
  const tooFast = s.texts().filter(x => /Слишком много/.test(x));
  assert.strictEqual(tooFast.length, 1);
  // 30 handled: the first /start sends welcome + question (2), the other 29 re-ask (1 each); +1 warning.
  assert.strictEqual(s.calls.filter(c => c.method === 'sendMessage').length, 2 + 29 + 1);
});

test('restart mid-registration: a new bot on the same DB continues the same step', async () => {
  const s1 = setup();
  await s1.send('/start'); await s1.send('Азамат');
  const s2 = setup(s1.conn);                      // "process restarted": fresh bot, same database
  await s2.send('0555 111 222');
  assert.match(s2.lastText(), /В каком городе/);
  assert.strictEqual(s2.store.getByTelegramId(USER).phone, '+996555111222');
});

test('«/» menu commands open the same sections as the buttons', async () => {
  const s = setup();
  await s.send('/add');
  assert.match(s.lastText(), /имя или название компании/);   // not registered yet → registration
  await s.send('Ош Авто'); await s.send('0555 111 222'); await s.send('Бишкек'); await s.press('reg:accept');
  await s.send('/profile');
  assert.match(s.lastText(), /^Ваш профиль/);
  await s.send('/mycars');
  assert.match(s.lastText(), /пока нет авто/);
  await s.send('/add');
  assert.match(s.lastText(), /Марка автомобиля/);
  const { PARTNER_COMMANDS } = require('../bot/bot');
  assert.deepStrictEqual(PARTNER_COMMANDS.map(c => c.command), ['start', 'add', 'mycars', 'profile', 'help']);
});
