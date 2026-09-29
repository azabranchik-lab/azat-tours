// Builds the partner bot: middleware (partner, blocked, rate limit) and routing.
// Admin-group handling (moderation) arrives in a later phase.
const { Bot, InlineKeyboard } = require('grammy');
const { t: translate } = require('../i18n');
const { isRegistered } = require('../store');
const { mainMenu, menuKey } = require('./menus');
const reg = require('./registration');
const profile = require('./profile');
const wizard = require('./carWizard/handlers');
const summary = require('./carWizard/summary');
const photos = require('./carWizard/photos');

// Telegram file -> Buffer (bots can download files up to 20 MB).
async function downloadFile(bot, token, fileId) {
  const f = await bot.api.getFile(fileId);
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`);
  if (!res.ok) throw new Error(`file download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const RATE_WINDOW_MS = 60000;   // per-user limit window (SPEC §8)

function createBot({ cfg, store, cars, storage, download }) {
  const bot = new Bot(cfg.token);
  const isAdmin = id => cfg.adminIds.includes(Number(id));
  const baseParams = {
    percent: cfg.commissionPercent,
    whatsapp: cfg.supportWhatsapp,
    site: cfg.siteUrl.replace(/^https?:\/\//, '')
  };

  // Partner flows run in private chats only.
  bot.use(async (ctx, next) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== 'private') return;
    return next();
  });

  // Rate limit, in memory: a restart simply resets the counters.
  const hits = new Map();
  const RATE_LIMIT = cfg.rateLimitPerMin || 60;
  bot.use(async (ctx, next) => {
    const nowMs = Date.now();
    const list = (hits.get(ctx.from.id) || []).filter(ts => nowMs - ts < RATE_WINDOW_MS);
    list.push(nowMs);
    hits.set(ctx.from.id, list);
    if (list.length > RATE_LIMIT) {
      if (list.length === RATE_LIMIT + 1 && ctx.chat) await ctx.reply(translate('RU', 'too_fast'));
      if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
      return;
    }
    return next();
  });

  // Load (or create) the partner and attach helpers.
  bot.use(async (ctx, next) => {
    let p = store.getOrCreate(ctx.from.id, ctx.from.username);
    if ((ctx.from.username || null) !== (p.username || null)) {
      store.update(p.id, { username: ctx.from.username || null });
      p = store.getById(p.id);
    }
    ctx.partner = p;
    ctx.cfg = cfg;
    ctx.store = store;
    ctx.cars = cars;
    ctx.storage = storage;
    ctx.download = fileId => (download ? download(fileId) : downloadFile(bot, cfg.token, fileId));
    ctx.isAdmin = isAdmin(ctx.from.id);
    ctx.t = (key, params) => translate(p.lang, key, { ...baseParams, ...params });
    ctx.setState = state => { store.setState(p.id, state); ctx.partner.state = state; };
    if (p.status === 'BLOCKED') {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
      return ctx.reply(ctx.t('blocked'));
    }
    return next();
  });

  const flow = ctx => (ctx.partner.state && ctx.partner.state.flow) || null;

  async function showHelp(ctx) {
    const kb = new InlineKeyboard().url(ctx.t('btn_whatsapp'), reg.waUrl(cfg));
    return ctx.reply(ctx.t('help'), { reply_markup: kb });
  }

  async function onMenu(ctx, key) {
    ctx.setState(null); // a menu tap abandons any half-finished edit
    if (key === 'menu_profile') return profile.show(ctx);
    if (key === 'menu_help') return showHelp(ctx);
    if (key === 'menu_add') return wizard.startAdd(ctx);
    return ctx.reply(ctx.t('coming_soon'), { reply_markup: mainMenu(ctx.t) }); // menu_my: phase 5
  }

  bot.command('start', async ctx => {
    if (!isRegistered(ctx.partner)) return reg.start(ctx);
    ctx.setState(null);
    return ctx.reply(ctx.t('menu_hint'), { reply_markup: mainMenu(ctx.t) });
  });

  bot.command('help', ctx => (isRegistered(ctx.partner) ? showHelp(ctx) : reg.start(ctx)));

  bot.on('message:contact', async ctx => {
    if (flow(ctx) === 'reg') return reg.onContact(ctx);
    if (flow(ctx) === 'profile') return profile.onContact(ctx);
    if (!isRegistered(ctx.partner)) return reg.start(ctx);
    return ctx.reply(ctx.t('menu_hint'), { reply_markup: mainMenu(ctx.t) });
  });

  bot.on('message:text', async ctx => {
    if (!isRegistered(ctx.partner)) {
      return flow(ctx) === 'reg' ? reg.onText(ctx) : reg.start(ctx);
    }
    const key = menuKey(ctx.t, ctx.message.text);
    if (key) return onMenu(ctx, key);
    if (flow(ctx) === 'profile') return profile.onText(ctx);
    if (flow(ctx) === 'car') return wizard.onText(ctx);
    return ctx.reply(ctx.t('menu_hint'), { reply_markup: mainMenu(ctx.t) });
  });

  bot.on('callback_query:data', async ctx => {
    const parts = ctx.callbackQuery.data.split(':');
    const [scope, action] = parts;
    if (scope === 'reg' && action === 'accept') return reg.onAccept(ctx);
    if (!isRegistered(ctx.partner)) {
      await ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
      return reg.start(ctx);
    }
    if (scope === 'prof') return profile.onCallback(ctx, action);
    if (scope === 'w') return wizard.onCallback(ctx, parts);
    if (scope === 'add') return wizard.onAddCallback(ctx, action, parts[2]);
    if (scope === 'sum') return summary.onCallback(ctx, parts);
    return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
  });

  bot.on(['message:photo', 'message:document'], async (ctx, next) => {
    if (isRegistered(ctx.partner) && await photos.onPhoto(ctx)) return;
    return next();
  });

  // Photos, stickers, voice… outside a flow that expects them.
  bot.on('message', async ctx => {
    if (!isRegistered(ctx.partner)) return reg.start(ctx);
    return ctx.reply(ctx.t('menu_hint'), { reply_markup: mainMenu(ctx.t) });
  });

  bot.catch(async err => {
    const ctx = err.ctx;
    console.error('[partners] bot error:', err.error);
    try { await ctx.reply(translate('RU', 'error_generic')); } catch (e) {}
    if (cfg.adminChatId) {
      // Short, no tokens or personal data: error type + update kind only.
      const kind = ctx && ctx.update ? Object.keys(ctx.update).filter(k => k !== 'update_id').join(',') : '?';
      const name = (err.error && (err.error.name || err.error.constructor.name)) || 'Error';
      const msg = String((err.error && err.error.message) || '').slice(0, 200).replace(/\d{6,}/g, '…');
      bot.api.sendMessage(cfg.adminChatId, `⚠️ Ошибка в боте партнёров (${kind}): ${name}: ${msg}`).catch(() => {});
    }
  });

  return bot;
}

module.exports = { createBot };
