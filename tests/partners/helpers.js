// Test harness: the real grammY partner bot with the Telegram API faked
// (no network, no token) and an in-memory SQLite DB.
const fs = require('fs');
const db = require('../../partners/db');
const { createStore } = require('../../partners/store');
const { createCars } = require('../../partners/cars');
const { createBot } = require('../../partners/bot/bot');
const { LocalStorage } = require('../../partners/storage/LocalStorage');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

// A real image buffer (default: a 1200x900 JPEG, big enough for the 600 px check).
function makeImage(width = 1200, height = 900, format = 'jpeg') {
  return sharp({ create: { width, height, channels: 3, background: '#6a8f4e' } })[format]().toBuffer();
}

const OWNER = 913187557;
const USER = 5550001;

// Pass a previous harness's `conn` to simulate a process restart on the same DB.
// Pass a previous harness's `storage` too, to keep its photo folder.
function setup(conn = db.open(':memory:'), extra = {}, storage = null, deps = {}) {
  const store = createStore(conn);
  const cars = createCars(conn);
  storage = storage || new LocalStorage(fs.mkdtempSync(path.join(os.tmpdir(), 'car-photos-')));
  const files = new Map(); // Telegram file_id -> Buffer, served by the fake download
  const cfg = {
    token: '1:fake', adminIds: [OWNER], adminChatId: 0, commissionPercent: 15, offerVersion: '2026-09',
    supportWhatsapp: '+996502888001', photoMaxMb: 10, minFreeDiskGb: 3, siteUrl: 'https://azattours.com',
    rateLimitPerMin: 1000, albumDebounceMs: 5, ...extra
  };
  const download = async fileId => {
    if (!files.has(fileId)) throw new Error('unknown file ' + fileId);
    return files.get(fileId);
  };
  const bot = createBot({ cfg, store, cars, storage, download, ...deps });
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

  // Send a photo (or a document when opts.document is set). opts: { buf, groupId, document: { mime, name, size } }
  let fid = 0;
  async function sendPhoto(opts = {}) {
    const buf = opts.buf || await makeImage();
    const id = 'file' + (++fid);
    files.set(id, buf);
    const media = opts.document
      ? { document: { file_id: id, file_unique_id: 'u' + id, mime_type: opts.document.mime, file_name: opts.document.name, file_size: opts.document.size || buf.length } }
      : { photo: [{ file_id: 'small' + id, file_unique_id: 's' + id, width: 90, height: 60, file_size: 900 }, { file_id: id, file_unique_id: 'u' + id, width: 1200, height: 900, file_size: buf.length }] };
    return bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: chat(), from: from(), ...(opts.groupId ? { media_group_id: opts.groupId } : {}), ...media } });
  }
  async function sendPhotos(n, opts) { for (let i = 0; i < n; i++) await sendPhoto(opts); }

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

  return { bot, conn, store, cars, storage, calls, send, contact, press, tap, hasButton, lastText, texts, lastAnswer, register, sendPhoto, sendPhotos };
}

module.exports = { setup, makeImage, OWNER, USER };
