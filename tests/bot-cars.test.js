// Cars section of the admin bot, driven through grammY with the Telegram API faked
// (no token, no network) and content/ in a throwaway folder.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.AZAT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'azat-root-'));
const sharp = require('sharp');
const { Bot, InlineKeyboard } = require('grammy');
const C = require('../lib/content');
const Images = require('../lib/images');
const registerCars = require('../lib/bot-cars');

const OWNER = 913187557;

// Mirrors the wiring in bot.js: cars registered first, then /done, then the routers.
function setup() {
  fs.rmSync(path.join(C.ROOT, 'content'), { recursive: true, force: true });
  fs.rmSync(path.join(C.PUBLIC, 'images'), { recursive: true, force: true });
  const bot = new Bot('1:fake');
  bot.botInfo = { id: 1, is_bot: true, first_name: 'Admin', username: 'admin_test_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false };
  const sessions = new Map();
  const md = { parse_mode: 'HTML' };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const b = s => `<b>${esc(s)}</b>`;
  const cancelKb = () => new InlineKeyboard().text('✖️ Cancel', 'x:cancel');
  const ask = (ctx, text) => ctx.reply(text, { ...md, reply_markup: cancelKb() });
  const files = new Map();
  const downloadPhoto = async (ctx, fileId, kind, slug, n) => {
    const out = await Images.save(files.get(fileId), path.join(C.PUBLIC, 'images', 'cars', `${slug}-${n}-${fileId}`), '.jpg');
    return 'images/cars/' + out.file;
  };
  const delFile = rel => Images.remove(path.join(C.PUBLIC, rel));
  const albums = [];
  const sendAlbum = async (ctx, images) => { albums.push(images.slice()); };

  const cars = registerCars(bot, { C, sessions, md, esc, b, ask, cancelKb, sendAlbum, delFile, downloadPhoto, InlineKeyboard });
  bot.command('cancel', ctx => { sessions.delete(ctx.from.id); return ctx.reply('Cancelled.'); });
  bot.command('done', async ctx => { const s = sessions.get(ctx.from.id); if (s) await cars.onDone(ctx, s); });
  bot.on('message:text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    const s = sessions.get(ctx.from.id); if (s) await cars.onText(ctx, s);
  });
  bot.on('message:photo', async ctx => {
    const s = sessions.get(ctx.from.id); if (!s) return;
    await cars.onPhoto(ctx, s, ctx.message.photo.at(-1).file_id, String(Date.now()).slice(-5));
  });

  const sent = new Map(); let mid = 100;
  bot.api.config.use(async (prev, method, payload) => {
    const rows = payload.reply_markup && payload.reply_markup.inline_keyboard;
    if (rows && rows.some(r => !r.length)) throw new Error('empty keyboard row in ' + method);
    if (rows) for (const k of rows.flat()) if (k.callback_data && Buffer.byteLength(k.callback_data) > 64) throw new Error('callback_data > 64 bytes: ' + k.callback_data);
    if (method === 'sendMessage') { const id = ++mid; sent.set(id, { text: payload.text, kb: payload.reply_markup }); return { ok: true, result: { message_id: id, date: 0, chat: { id: OWNER, type: 'private' }, text: payload.text } }; }
    if (method === 'editMessageText') { const m = sent.get(payload.message_id); if (m) { m.text = payload.text; m.kb = payload.reply_markup; } }
    return { ok: true, result: true };
  });

  let uid = 1;
  const from = { id: OWNER, is_bot: false, first_name: 'Azat' };
  const chat = { id: OWNER, type: 'private', first_name: 'Azat' };
  const send = text => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat, from, text, ...(text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } : {}) } });
  const buttons = m => ((m && m.kb && m.kb.inline_keyboard) || []).flat();
  const tap = label => {
    for (const [id, m] of [...sent.entries()].reverse()) {
      const k = buttons(m).find(x => x.text === label);
      if (k) return bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from, chat_instance: '1', data: k.callback_data, message: { message_id: id, date: 0, chat, text: m.text } } });
    }
    throw new Error(`no button "${label}"; last message: ${lastText()}`);
  };
  let fid = 0;
  const photo = async (w = 2000, h = 1500) => {
    const id = 'f' + (++fid);
    files.set(id, await sharp({ create: { width: w, height: h, channels: 3, background: '#335577' } }).jpeg().toBuffer());
    return bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat, from, photo: [{ file_id: id, file_unique_id: 'u' + id, width: w, height: h }] } });
  };
  const press = data => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from, chat_instance: '1', data, message: { message_id: 1, date: 0, chat, text: 'x' } } });
  const lastText = () => [...sent.values()].at(-1).text;
  const texts = () => [...sent.values()].map(m => m.text);
  return { bot, cars, sessions, send, tap, press, photo, lastText, texts, albums };
}

async function addCar(h, name = 'Toyota Land Cruiser Prado 2019') {
  await h.send('/addcar');
  await h.send(name);
  await h.tap('SUV'); await h.tap('Automatic'); await h.tap('4x4'); await h.tap('Diesel'); await h.tap('7');
  await h.send('$85');
  await h.send('140');
  await h.send('Comfortable 4x4 for mountain roads.');
  await h.photo(); await h.photo();
  await h.send('/done');
  return C.loadCars()[0];
}

test('/addcar creates a draft with everything the owner entered', async () => {
  const h = setup();
  const c = await addCar(h);
  assert.strictEqual(c.status, 'draft');
  assert.deepStrictEqual(
    { make: c.make, model: c.model, year: c.year, name: c.name, slug: c.slug, type: c.type, transmission: c.transmission, drive: c.drive, fuel: c.fuel, seats: c.seats, priceSelf: c.priceSelf, priceDriver: c.priceDriver, available: c.available },
    { make: 'Toyota', model: 'Land Cruiser Prado', year: 2019, name: 'Toyota Land Cruiser Prado 2019', slug: 'toyota-land-cruiser-prado-2019', type: 'SUV', transmission: 'Automatic', drive: '4x4', fuel: 'Diesel', seats: 7, priceSelf: 85, priceDriver: 140, available: true });
  assert.strictEqual(c.summary, 'Comfortable 4x4 for mountain roads.');
  assert.strictEqual(c.images.length, 2);
  for (const im of c.images) {
    assert.match(im, /^images\/cars\/toyota-land-cruiser-prado-2019-.*\.jpg$/);
    for (const f of [im, im + '.webp', Images.thumbOf(im), Images.thumbOf(im) + '.webp']) assert.ok(fs.existsSync(path.join(C.PUBLIC, f)), f);
  }
  assert.match(h.texts().join('\n'), /Saved as a draft/);
  assert.ok(!h.sessions.size);
});

test('wizard re-asks on a name without a year and on a non-number price', async () => {
  const h = setup();
  await h.send('/addcar');
  await h.send('Toyota Camry');
  assert.match(h.lastText(), /make, model and year/);
  await h.send('Toyota Camry 2020');
  await h.send('anything'); // typed instead of tapping a button
  assert.match(h.lastText(), /type/);
  await h.tap('Sedan'); await h.tap('Automatic'); await h.tap('2WD'); await h.tap('Petrol'); await h.tap('5');
  await h.send('cheap');
  assert.match(h.lastText(), /just a number/);
  await h.send('0');
  await h.send('0');
  assert.match(h.lastText(), /can't be 0/);
  await h.send('60');
  await h.send('skip');
  await h.send('/done');
  const c = C.loadCars()[0];
  assert.strictEqual(c.priceSelf, 0);
  assert.strictEqual(c.priceDriver, 60);
  assert.strictEqual(c.summary, '');
});

test('a car without photos cannot be published; with photos it can, then hidden', async () => {
  const h = setup();
  await h.send('/addcar'); await h.send('Hyundai Starex 2015');
  await h.tap('Minivan'); await h.tap('Manual'); await h.tap('2WD'); await h.tap('Diesel'); await h.tap('8+');
  await h.send('70'); await h.send('0'); await h.send('skip');
  await h.send('/done');
  let c = C.loadCars()[0];
  assert.strictEqual(c.seats, 8);
  await h.tap('✅ Publish');
  assert.match(h.lastText(), /Still missing: at least one photo/);
  assert.strictEqual(C.loadCars()[0].status, 'draft');

  await h.tap('🖼 Photos'); await h.tap('➕ Add photos');
  await h.photo(); await h.send('/done');
  assert.match(h.lastText(), /1 photo\(s\)/);
  await h.send('/cars'); await h.tap('📝 Hyundai Starex 2015 · $70/d');
  await h.tap('✅ Publish');
  assert.strictEqual(C.loadCars()[0].status, 'published');
  assert.ok(C.loadCars()[0].updatedAt);
  await h.tap('🚫 Hide from website');
  assert.strictEqual(C.loadCars()[0].status, 'hidden');
});

test('booked/available toggles in place', async () => {
  const h = setup();
  await addCar(h);
  await h.tap('🔴 Mark booked');
  assert.strictEqual(C.loadCars()[0].available, false);
  assert.match(h.lastText(), /🔴 Booked/);
  await h.tap('🟢 Mark available');
  assert.strictEqual(C.loadCars()[0].available, true);
});

test('editing: picker, number, features, rename keeps the URL', async () => {
  const h = setup();
  const before = await addCar(h);
  await h.tap('✏️ Edit'); await h.tap('Gearbox'); await h.tap('Manual');
  assert.strictEqual(C.loadCars()[0].transmission, 'Manual');
  await h.tap('✏️ Edit'); await h.tap('Deposit $'); await h.send('200 usd');
  assert.strictEqual(C.loadCars()[0].deposit, 200);
  await h.tap('✏️ Edit'); await h.tap('Features'); await h.send('Air conditioning, Roof rack\nChild seat');
  assert.deepStrictEqual(C.loadCars()[0].features, ['Air conditioning', 'Roof rack', 'Child seat']);
  await h.tap('✏️ Edit'); await h.tap('Make, model, year'); await h.send('Toyota Prado 150 2020');
  const c = C.loadCars()[0];
  assert.strictEqual(c.name, 'Toyota Prado 150 2020');
  assert.strictEqual(c.slug, before.slug);
  await h.tap('✏️ Edit'); await h.tap('Description'); await h.send('-');
  assert.strictEqual(C.loadCars()[0].summary, '');
});

test('a published car must keep at least one price', async () => {
  const h = setup();
  await addCar(h);
  await h.tap('✅ Publish');
  await h.tap('✏️ Edit'); await h.tap('Self-drive $/day'); await h.send('0');
  await h.tap('✏️ Edit'); await h.tap('With driver $/day'); await h.send('0');
  assert.match(h.lastText(), /at least one price/);
  assert.strictEqual(C.loadCars()[0].priceDriver, 140);
});

test('photos: cover, reorder, delete removes the files', async () => {
  const h = setup();
  const c = await addCar(h);
  const [first, second] = c.images;
  await h.tap('🖼 Photos');
  assert.deepStrictEqual(h.albums.at(-1), [first, second]);
  await h.tap('🔽'); // first photo down
  assert.deepStrictEqual(C.loadCars()[0].images, [second, first]);
  await h.tap('🗑');
  await h.tap('🗑 Yes, delete');
  assert.deepStrictEqual(C.loadCars()[0].images, [first]);
  assert.ok(!fs.existsSync(path.join(C.PUBLIC, second)));
  assert.ok(!fs.existsSync(path.join(C.PUBLIC, Images.thumbOf(second) + '.webp')));
});

test('deleting a car removes its photos', async () => {
  const h = setup();
  const c = await addCar(h);
  await h.tap('🗑 Delete'); await h.tap('🗑 Yes, delete');
  assert.deepStrictEqual(C.loadCars(), []);
  for (const im of c.images) assert.ok(!fs.existsSync(path.join(C.PUBLIC, im)));
  assert.match(h.lastText(), /No cars yet/);
});

test('two cars with the same name get different addresses', async () => {
  const h = setup();
  await addCar(h);
  await addCar(h);
  const slugs = C.loadCars().map(c => c.slug).sort();
  assert.deepStrictEqual(slugs, ['toyota-land-cruiser-prado-2019', 'toyota-land-cruiser-prado-2019-2']);
});

test('old buttons do nothing harmful', async () => {
  const h = setup();
  await h.send('/addcar'); await h.send('Kia Sorento 2021');
  await h.tap('SUV');
  // the answered question lost its buttons; a stale tap (old message) changes nothing
  await h.press('cw:type:1');
  assert.strictEqual(h.sessions.get(OWNER).step, 'transmission');
  assert.strictEqual(h.sessions.get(OWNER).draft.type, 'SUV');
});
