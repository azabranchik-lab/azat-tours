// Test harness: the real grammY partner bot with the Telegram API faked
// (no network, no token) and an in-memory SQLite DB.
const db = require('../../partners/db');
const { createStore } = require('../../partners/store');
const { createCars } = require('../../partners/cars');
const { createBot } = require('../../partners/bot/bot');

const OWNER = 913187557;
const USER = 5550001;

// Pass a previous harness's `conn` to simulate a process restart on the same DB.
function setup(conn = db.open(':memory:'), extra = {}) {
  const store = createStore(conn);
  const cars = createCars(conn);
  const cfg = {
    token: '1:fake', adminIds: [OWNER], adminChatId: 0, commissionPercent: 15, offerVersion: '2026-09',
    supportWhatsapp: '+996502888001', photoMaxMb: 10, minFreeDiskGb: 3, siteUrl: 'https://azattours.com',
    rateLimitPerMin: 60, ...extra
  };
  const bot = createBot({ cfg, store, cars });
  bot.botInfo = { id: 1, is_bot: true, first_name: 'Partners', username: 'partners_test_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false };
  const calls = [];
  const sent = new Map(); // message_id -> { text, reply_markup }
  let mid = 1000;
  bot.api.config.use(async (prev, method, payload) => {
    calls.push({ method, payload });
    const rows = payload.reply_markup && payload.reply_markup.inline_keyboard;
    if (rows && rows.some(r => !r.length)) throw new Error(`empty keyboard row in ${method}`);
    if (rows) for (const b of rows.flat()) if (b.callback_data && Buffer.byteLength(b.callback_data) > 64) throw new Error(`callback_data > 64 bytes: ${b.callback_data}`);
    if (method === 'sendMessage') {
      const id = ++mid;
      sent.set(id, { text: payload.text, reply_markup: payload.reply_markup });
      return { ok: true, result: { message_id: id, date: 0, chat: { id: payload.chat_id, type: 'private' }, text: payload.text } };
    }
    if (method === 'editMessageReplyMarkup' || method === 'editMessageText') {
      const m = sent.get(payload.message_id);
      if (m) {
        if (payload.text !== undefined) m.text = payload.text;
        m.reply_markup = payload.reply_markup;
      }
    }
    return { ok: true, result: true };
  });

  let uid = 1;
  const from = () => ({ id: USER, is_bot: false, first_name: 'Test', username: 'tester' });
  const chat = () => ({ id: USER, type: 'private', first_name: 'Test' });
  const send = text => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(), from: from(), text, ...(text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } : {}) } });
  const contact = (phone, userId = USER) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(), from: from(), contact: { phone_number: phone, first_name: 'Test', user_id: userId } } });
  const press = (data, messageId = 1) => {
    const m = sent.get(messageId);
    return bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: from(), chat_instance: '1', data, message: { message_id: messageId, date: 0, chat: chat(), text: m ? m.text : 'x' } } });
  };

  const sentList = () => [...sent.entries()];
  const lastText = () => sentList().at(-1)[1].text;
  const texts = () => sentList().map(([, m]) => m.text);
  const buttons = m => ((m && m.reply_markup && m.reply_markup.inline_keyboard) || []).flat();
  // Press the inline button with this label on the newest message that still shows it.
  const tap = label => {
    for (const [id, m] of sentList().reverse()) {
      const b = buttons(m).find(x => x.text === label);
      if (b) return press(b.callback_data, id);
    }
    throw new Error(`no visible button "${label}"; last message: ${lastText()}`);
  };
  const hasButton = label => sentList().some(([, m]) => buttons(m).some(x => x.text === label));
  const lastAnswer = () => { const c = [...calls].reverse().find(x => x.method === 'answerCallbackQuery'); return c && c.payload.text; };

  async function register() {
    await send('/start'); await send('Ош Авто'); await send('0555 111 222'); await send('Бишкек');
    await tap('Принимаю');
  }

  return { conn, store, cars, calls, send, contact, press, tap, hasButton, lastText, texts, lastAnswer, register };
}

module.exports = { setup, OWNER, USER };
