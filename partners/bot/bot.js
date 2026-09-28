// Builds the partner bot: middleware (partner, blocked, rate limit) and routing.
// Admin-group handling (moderation) arrives in a later phase.
const { Bot, InlineKeyboard } = require('grammy');
const { t: translate } = require('../i18n');
const { isRegistered } = require('../store');
const { mainMenu, menuKey } = require('./menus');
const reg = require('./registration');
const profile = require('./profile');

const RATE_LIMIT = 30;          // updates per user…
const RATE_WINDOW_MS = 60000;   // …per minute (SPEC §8)

function createBot({ cfg, store }) {
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
    return ctx.reply(ctx.t('coming_soon'), { reply_markup: mainMenu(ctx.t) }); // menu_add / menu_my: next phases
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
    return ctx.reply(ctx.t('menu_hint'), { reply_markup: mainMenu(ctx.t) });
  });

  bot.on('callback_query:data', async ctx => {
    const [scope, action] = ctx.callbackQuery.data.split(':');
    if (scope === 'reg' && action === 'accept') return reg.onAccept(ctx);
    if (!isRegistered(ctx.partner)) {
      await ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
      return reg.start(ctx);
    }
    if (scope === 'prof') return profile.onCallback(ctx, action);
    return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
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
