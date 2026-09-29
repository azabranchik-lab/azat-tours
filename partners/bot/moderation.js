// Submit + moderation in the admin group (SPEC §6.5, §6.6).
//
// Flow: partner submits → album + card in the group [Одобрить][Отклонить][Заменить фото]
//   Одобрить → APPROVED at once (no translation, owner's decision 2026-09-29),
//              site data rebuilt, partner notified
//   Отклонить → admin replies with a reason → REJECTED, partner gets it with [Исправить]
//
// Admin replies are matched by a tag on the last line of the bot's prompt
// (#reason / #photo + car id), so they survive restarts without state.
const { InlineKeyboard } = require('grammy');
const P = require('../lib/photos');
const { carCard, carTitle } = require('../lib/format');
const { sendAlbum } = require('../lib/album');
const { mainMenu, tidy } = require('./menus');
const { t: translate } = require('../i18n');

const a = (key, params) => translate('RU', key, params); // admin side is Russian

const when = () => new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const who = from => (from.username ? '@' + from.username : [from.first_name, from.last_name].filter(Boolean).join(' '));

function adminCard(ctx, car) {
  const partner = ctx.store.getById(car.partnerId);
  const title = car.rejectReason
    ? a('mod_title_again', { car: carTitle(car, a), reason: car.rejectReason })
    : a(car.approvedAt ? 'mod_title_edit' : 'mod_title_new', { car: carTitle(car, a) });
  return [
    title,
    a('mod_partner', { name: partner.name, phone: partner.phone, username: partner.username ? '@' + partner.username : '-' }),
    car.plateOnPhotos ? a('mod_plate_' + car.plateOnPhotos) : '',
    carCard(car, a, ctx.cars.photos(car.id), { title: false }),
    `#car ${car.id}`
  ].filter(Boolean).join('\n\n');
}

const cardKeyboard = car => new InlineKeyboard()
  .text(a('btn_approve'), `mod:ok:${car.id}`).text(a('btn_reject'), `mod:no:${car.id}`).row()
  .text(a('btn_replace_photo'), `mod:ph:${car.id}`);

function angleKeyboard(car) {
  const kb = new InlineKeyboard();
  P.REQUIRED_ANGLES.forEach((ang, i) => { kb.text(a('angle_' + ang), `mod:pa:${car.id}:${i}`); if (i % 2 === 1) kb.row(); });
  return tidy(kb.row().text(a('btn_back'), `mod:bk:${car.id}`));
}

// ----- partner side -----

async function submit(ctx, car) {
  const cfg = ctx.cfg;
  ctx.cars.update(car.id, { status: 'PENDING', submittedAt: new Date().toISOString(), draftStep: null });
  const { clearKb } = require('./carWizard/handlers');
  await clearKb(ctx, ctx.partner.state && ctx.partner.state.qmsg);
  ctx.setState(null);
  await ctx.reply(ctx.t('submitted'), { reply_markup: mainMenu(ctx.t) });

  if (!cfg.adminChatId) { console.warn(`[partners] car ${car.id} submitted but no admin group is connected`); return; }
  const fresh = ctx.cars.get(car.id);
  try { await sendAlbum(ctx.api, cfg.adminChatId, ctx.storage, ctx.cars.photos(car.id)); } catch (e) { console.error('[partners] moderation album failed:', e.message); }
  const msg = await ctx.api.sendMessage(cfg.adminChatId, adminCard(ctx, fresh), { reply_markup: cardKeyboard(fresh) });
  ctx.cars.update(car.id, { modMessageId: msg.message_id });
}

// «Исправить» after a rejection.
async function onFix(ctx, id) {
  const car = ctx.cars.get(id);
  if (!car || car.partnerId !== ctx.partner.id || car.status !== 'REJECTED') return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
  await ctx.answerCallbackQuery();
  await ctx.reply(ctx.t('fix_intro', { reason: car.rejectReason || '' }));
  return require('./carWizard/summary').show(ctx, car, { withPhotos: true });
}

async function notifyPartner(ctx, car, key, params, kb) {
  const p = ctx.store.getById(car.partnerId);
  const text = translate(p.lang, key, { car: carTitle(car, a), ...params });
  try { await ctx.api.sendMessage(p.telegramId, text, kb ? { reply_markup: kb } : {}); } catch (e) {
    console.warn(`[partners] could not notify partner ${p.id}: ${e.message}`);
  }
}

// ----- admin side -----

async function setCardStatus(ctx, car, line, kb = { inline_keyboard: [] }) {
  if (!car.modMessageId) return;
  await ctx.api.editMessageText(ctx.cfg.adminChatId, car.modMessageId, `${adminCard(ctx, car)}\n\n${line}`, { reply_markup: kb }).catch(() => {});
}

function logAction(ctx, car, action, comment) {
  ctx.cars.logModeration(car.id, ctx.from.id, action, comment);
}

// Update the card that was pressed, and the group card if that was another message.
async function markDone(ctx, car, line, kb = { inline_keyboard: [] }) {
  const pressed = ctx.callbackQuery && ctx.callbackQuery.message;
  if (pressed) await ctx.editMessageText(`${adminCard(ctx, car)}\n\n${line}`, { reply_markup: kb }).catch(() => {});
  if (!pressed || pressed.message_id !== car.modMessageId || pressed.chat.id !== ctx.cfg.adminChatId) await setCardStatus(ctx, car, line, kb);
}

// On an approved card: get everything needed to add the car to the site by hand.
const filesKeyboard = car => new InlineKeyboard().text(a('btn_site_files'), `adm:files:${car.id}`);

async function approve(ctx, car) {
  await ctx.answerCallbackQuery();
  const updated = ctx.cars.update(car.id, { status: 'APPROVED', approvedAt: new Date().toISOString(), rejectReason: null });
  logAction(ctx, updated, 'APPROVE');
  await markDone(ctx, updated, a('mod_status_approved', { admin: who(ctx.from), time: when() }), filesKeyboard(updated));
  await ctx.onCarsChanged();
  return notifyPartner(ctx, updated, 'approved');
}

async function askReply(ctx, text) {
  return ctx.reply(text, { reply_markup: { force_reply: true, input_field_placeholder: '…' } });
}

async function onCallback(ctx, parts) {
  const [, action, id, arg] = parts;
  if (!ctx.isAdminUser) return ctx.answerCallbackQuery({ text: a('no_access'), show_alert: true });
  const car = ctx.cars.get(id);
  if (!car || car.status !== 'PENDING') {
    await ctx.answerCallbackQuery({ text: a('already_done') });
    return ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
  }
  const title = carTitle(car, a);

  if (action === 'ok') return approve(ctx, car);
  if (action === 'no') {
    await ctx.answerCallbackQuery();
    return askReply(ctx, `${a('mod_ask_reason', { car: title })}\n#reason ${car.id}`);
  }
  if (action === 'ph') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageReplyMarkup({ reply_markup: angleKeyboard(car) }).catch(() => {});
  }
  if (action === 'bk') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageReplyMarkup({ reply_markup: cardKeyboard(car) }).catch(() => {});
  }
  if (action === 'pa') {
    const angle = P.REQUIRED_ANGLES[Number(arg)];
    if (!angle) return ctx.answerCallbackQuery({ text: a('stale_button') });
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: cardKeyboard(car) }).catch(() => {});
    return askReply(ctx, `${a('mod_ask_photo', { angle: a('angle_' + angle), car: title })}\n#photo ${car.id} ${angle}`);
  }
  return ctx.answerCallbackQuery({ text: a('stale_button') });
}

// Admin replied to one of the bot's prompts. Returns false if it is not ours.
async function onReply(ctx) {
  const prompt = ctx.message.reply_to_message;
  if (!prompt || !prompt.from || prompt.from.id !== ctx.me.id || !prompt.text) return false;
  const m = prompt.text.match(/#(reason|photo) ([\w-]+)(?: (\w+))?\s*$/);
  if (!m) return false;
  if (!ctx.isAdminUser) return true;
  const [, kind, id, extra] = m;
  const car = ctx.cars.get(id);
  if (!car || car.status !== 'PENDING') { await ctx.reply(a('already_done')); return true; }

  if (kind === 'reason') {
    const reason = String(ctx.message.text || '').trim();
    if (reason.length < 3 || reason.length > 500) { await ctx.reply(a('mod_reason_len')); return true; }
    const updated = ctx.cars.update(id, { status: 'REJECTED', rejectReason: reason });
    logAction(ctx, updated, 'REJECT', reason);
    const line = a('mod_status_rejected', { admin: who(ctx.from), time: when(), reason });
    await setCardStatus(ctx, updated, line);
    await ctx.reply(line);
    await notifyPartner(ctx, updated, 'rejected', { reason }, new InlineKeyboard().text(translate('RU', 'btn_fix'), `fix:${id}`));
    return true;
  }

  if (kind === 'photo' && P.REQUIRED_ANGLES.includes(extra)) {
    if (!ctx.message.photo && !ctx.message.document) return true;
    const file = require('./carWizard/photos').incoming(ctx.message);
    const check = P.checkIncoming(file, ctx.cfg.photoMaxMb);
    if (!check.ok) { await ctx.reply(a(check.error, { mb: ctx.cfg.photoMaxMb })); return true; }
    const img = await P.processImage(await ctx.download(file.fileId));
    if (!img.ok) { await ctx.reply(a(img.error)); return true; }
    await require('./carWizard/photos').store(ctx, car, extra, file, img);
    await ctx.reply(a('mod_photo_saved', { angle: a('angle_' + extra) }));
    return true;
  }
  return false;
}

module.exports = { submit, onFix, onCallback, onReply, adminCard, cardKeyboard };
