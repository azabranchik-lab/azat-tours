// Admin panel in the moderation group (SPEC §6.10, owner's choice 2026-09-29:
// everything admin lives in the group, never in private chats). Works only in
// the connected group (partners.adminChatId) and only for admins.
//
// /panel posts a panel [На проверке][Статистика][Выгрузка CSV][Найти партнёра];
// the same actions exist as commands: /pending /stats /export /partner /block /unblock.
const { InlineKeyboard, InputFile } = require('grammy');
const { t: translate } = require('../i18n');
const { carTitle } = require('../lib/format');
const { toCsv } = require('../lib/csv');
const { sendAlbum } = require('../lib/album');
const { tidy } = require('./menus');
const validators = require('../lib/validators');

const a = (key, params) => translate('RU', key, params);
const STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'PAUSED', 'REJECTED', 'ARCHIVED'];
const day = iso => (iso ? new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Asia/Bishkek' }) : '-');

const COMMANDS = [
  { command: 'panel', description: 'Панель управления' },
  { command: 'pending', description: 'Авто на проверке' },
  { command: 'stats', description: 'Статистика' },
  { command: 'export', description: 'Выгрузка CSV' },
  { command: 'partner', description: 'Найти партнёра: /partner телефон или ID' },
  { command: 'block', description: 'Заблокировать: /block Telegram ID' },
  { command: 'unblock', description: 'Разблокировать: /unblock Telegram ID' }
];

// The group's «/» menu shows admin commands; partners (private chats) never see them.
async function publishCommands(api, chatId) {
  if (!chatId) return;
  await api.setMyCommands(COMMANDS, { scope: { type: 'chat', chat_id: chatId } })
    .catch(e => console.warn('[partners] group commands not set:', e.message));
}

const panelKeyboard = () => new InlineKeyboard()
  .text(a('adm_btn_pending'), 'adm:pending').text(a('adm_btn_stats'), 'adm:stats').row()
  .text(a('adm_btn_export'), 'adm:export').text(a('adm_btn_find'), 'adm:find').row()
  .text(a('adm_btn_refresh'), 'adm:panel');

function panelText(ctx) {
  const c = ctx.cars.countByStatus();
  return a('adm_panel', { pending: c.PENDING || 0, approved: c.APPROVED || 0, partners: ctx.store.countRegistered() });
}

async function panel(ctx, edit = false) {
  if (edit) return ctx.editMessageText(panelText(ctx), { reply_markup: panelKeyboard() }).catch(() => {});
  const msg = await ctx.reply(panelText(ctx), { reply_markup: panelKeyboard() });
  // Pin it if the bot is allowed to; otherwise the text asks the owner to pin it.
  await ctx.api.pinChatMessage(ctx.chat.id, msg.message_id, { disable_notification: true }).catch(() => {});
  return msg;
}

async function pending(ctx) {
  const cars = ctx.cars.listByStatus('PENDING');
  if (!cars.length) return ctx.reply(a('adm_pending_none'));
  const kb = new InlineKeyboard();
  for (const car of cars.slice(0, 30)) {
    const p = ctx.store.getById(car.partnerId);
    const hours = Math.floor((Date.now() - new Date(car.submittedAt || car.updatedAt)) / 3600000);
    const ago = hours < 1 ? a('adm_ago_m') : a('adm_ago_h', { n: hours });
    kb.text(`${carTitle(car, a)} · ${p ? p.name : '?'} · ${ago}`, `adm:car:${car.id}`).row();
  }
  return ctx.reply(a('adm_pending_title', { n: cars.length }), { reply_markup: tidy(kb) });
}

// Re-post the moderation card (with album) for one pending car.
async function openCar(ctx, id) {
  const car = ctx.cars.get(id);
  if (!car || car.status !== 'PENDING') return ctx.reply(a('already_done'));
  const moderation = require('./moderation');
  try { await sendAlbum(ctx.api, ctx.chat.id, ctx.storage, ctx.cars.photos(car.id)); } catch (e) { console.error('[partners] album failed:', e.message); }
  const msg = await ctx.reply(moderation.adminCard(ctx, car), { reply_markup: moderation.cardKeyboard(car) });
  ctx.cars.update(car.id, { modMessageId: msg.message_id });
}

async function stats(ctx) {
  const c = ctx.cars.countByStatus();
  const s = ctx.store.counts();
  const free = ctx.storage.freeBytes();
  return ctx.reply(a('adm_stats', {
    partners: s.registered, blocked: s.blocked, unregistered: s.unregistered,
    ...Object.fromEntries(STATUSES.map(k => [k, c[k] || 0])),
    used: (ctx.storage.usedBytes() / 1024 / 1024).toFixed(1),
    free: free === null ? '?' : (free / 1024 ** 3).toFixed(1)
  }));
}

async function exportCsv(ctx) {
  const partners = ctx.store.listAll();
  const byId = Object.fromEntries(partners.map(p => [p.id, p]));

  const partnersCsv = toCsv(partners, [
    ['Telegram ID', p => p.telegramId], ['Username', p => p.username ? '@' + p.username : ''], ['Имя', p => p.name],
    ['Телефон', p => p.phone], ['Город', p => p.city], ['Статус', p => p.status],
    ['Условия приняты', p => p.offerAcceptedAt], ['Версия условий', p => p.offerVersion], ['Создан', p => p.createdAt]
  ]);
  const cars = ctx.cars.listAll();
  const carsCsv = toCsv(cars, [
    ['ID', c => c.id], ['Статус', c => c.status], ['Партнёр', c => (byId[c.partnerId] || {}).name], ['Телефон партнёра', c => (byId[c.partnerId] || {}).phone],
    ['Марка', c => c.make], ['Модель', c => c.model], ['Год', c => c.year], ['Кузов', c => c.bodyType], ['Коробка', c => c.transmission],
    ['Привод', c => c.drive], ['Топливо', c => c.fuel], ['Мест', c => c.seats], ['Цвет', c => c.color], ['Госномер', c => c.plateNumber],
    ['Пробег', c => c.mileageKm], ['Оснащение', c => c.features], ['Формат аренды', c => c.rentalModes],
    ['Без водителя, сом', c => c.priceSelfDrive], ['С водителем, сом', c => c.priceWithDriver], ['Скидка', c => c.longTermDiscount],
    ['Залог, сом', c => c.deposit], ['Страховка', c => c.insurance], ['Доставка', c => c.delivery],
    ['Требования к водителю', c => c.driverRequirements], ['Ограничения', c => c.restrictions], ['Когда свободно', c => c.availabilityNote],
    ['Город', c => c.city], ['Свободно', c => c.availability], ['Номер на фото', c => c.plateOnPhotos], ['Описание', c => c.description],
    ['Причина отклонения', c => c.rejectReason], ['Отправлено', c => c.submittedAt], ['Одобрено', c => c.approvedAt],
    ['Фото (файлы на сервере, content/car-photos/)', c => ctx.cars.photos(c.id).map(p => p.path).join(' ')]
  ]);
  const date = new Date().toISOString().slice(0, 10);
  await ctx.replyWithDocument(new InputFile(partnersCsv, `partners-${date}.csv`), { caption: a('adm_export_caption', { date }) });
  await ctx.replyWithDocument(new InputFile(carsCsv, `cars-${date}.csv`));
}

// Phone (any format) or Telegram ID.
function findPartner(ctx, q) {
  const s = String(q || '').trim();
  if (/^\d{5,15}$/.test(s)) {
    const byTg = ctx.store.getByTelegramId(Number(s));
    if (byTg) return byTg;
  }
  const ph = validators.phone(s);
  return ph.ok ? ctx.store.getByPhone(ph.value) : null;
}

async function showPartner(ctx, p) {
  const cars = ctx.cars.listAllByPartner(p.id);
  const lines = cars.map(c => `• ${carTitle(c, a)} · ${a('status_' + c.status)}`).join('\n') || a('adm_partner_nocars');
  const kb = new InlineKeyboard().text(
    p.status === 'BLOCKED' ? a('adm_btn_unblock') : a('adm_btn_block'),
    p.status === 'BLOCKED' ? `adm:unb:${p.id}` : `adm:blk:${p.id}`
  );
  return ctx.reply(a('adm_partner', {
    name: p.name || '-', phone: p.phone || '-', username: p.username ? '@' + p.username : '-', tgId: p.telegramId,
    city: p.city || '-', status: a(p.status === 'BLOCKED' ? 'adm_partner_blocked' : 'adm_partner_active'),
    date: day(p.offerAcceptedAt || p.createdAt), n: cars.length, cars: lines
  }), { reply_markup: kb });
}

async function setBlocked(ctx, p, blocked) {
  if (ctx.cfg.adminIds.includes(Number(p.telegramId))) return ctx.reply(a('adm_cant_block_admin'));
  ctx.store.update(p.id, { status: blocked ? 'BLOCKED' : 'ACTIVE' });
  // Their published cars leave (or come back to) the site.
  if (ctx.cars.listAllByPartner(p.id).some(c => c.status === 'APPROVED')) await ctx.onCarsChanged();
  return ctx.reply(a(blocked ? 'adm_blocked' : 'adm_unblocked', { name: p.name || p.telegramId }));
}

// ----- routing (called only for admins in the connected group) -----

async function onCommand(ctx, cmd, arg) {
  if (cmd === 'panel') return panel(ctx);
  if (cmd === 'pending') return pending(ctx);
  if (cmd === 'stats') return stats(ctx);
  if (cmd === 'export') return exportCsv(ctx);
  if (cmd === 'partner') {
    if (!arg) return ctx.reply(a('adm_usage_partner'));
    const p = findPartner(ctx, arg);
    return p ? showPartner(ctx, p) : ctx.reply(a('adm_find_none', { q: arg }));
  }
  if (cmd === 'block' || cmd === 'unblock') {
    const p = /^\d{5,15}$/.test(arg || '') ? ctx.store.getByTelegramId(Number(arg)) : null;
    if (!arg) return ctx.reply(a('adm_usage_block'));
    if (!p) return ctx.reply(a('adm_find_none', { q: arg }));
    return setBlocked(ctx, p, cmd === 'block');
  }
}

async function onCallback(ctx, parts) {
  const [, action, id] = parts;
  if (action === 'panel') { await ctx.answerCallbackQuery(); return panel(ctx, true); }
  if (action === 'pending') { await ctx.answerCallbackQuery(); return pending(ctx); }
  if (action === 'stats') { await ctx.answerCallbackQuery(); return stats(ctx); }
  if (action === 'export') { await ctx.answerCallbackQuery(); return exportCsv(ctx); }
  if (action === 'find') {
    await ctx.answerCallbackQuery();
    return ctx.reply(`${a('adm_find_ask')}\n#find`, { reply_markup: { force_reply: true } });
  }
  if (action === 'car') { await ctx.answerCallbackQuery(); return openCar(ctx, id); }
  if (action === 'keep') { await ctx.answerCallbackQuery(); return ctx.deleteMessage().catch(() => {}); }

  const p = id ? ctx.store.getById(id) : null;
  if (!p) return ctx.answerCallbackQuery({ text: a('stale_button') });
  if (action === 'blk') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text(a('adm_btn_block_yes'), `adm:blkok:${p.id}`).text(a('btn_back'), `adm:keep`);
    return ctx.reply(a('adm_block_confirm', { name: p.name || p.telegramId }), { reply_markup: kb });
  }
  if (action === 'blkok') {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
    return setBlocked(ctx, p, true);
  }
  if (action === 'unb') { await ctx.answerCallbackQuery(); return setBlocked(ctx, p, false); }
  return ctx.answerCallbackQuery({ text: a('stale_button') });
}

// Reply to the «Найти партнёра» prompt.
async function onFindReply(ctx) {
  const q = String(ctx.message.text || '').trim();
  const p = findPartner(ctx, q);
  return p ? showPartner(ctx, p) : ctx.reply(a('adm_find_none', { q }));
}

module.exports = { onCommand, onCallback, onFindReply, publishCommands, COMMANDS };
