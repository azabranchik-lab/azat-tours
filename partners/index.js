// AZAT TOURS car-partners bot (SPEC.md). A standalone program: its own folder,
// config.json, data/ and pm2 process; it shares nothing with the website.
//   npm start            (or: pm2 start ecosystem.config.js)
const config = require('./config');
const db = require('./db');
const { createStore } = require('./store');
const { createCars } = require('./cars');
const path = require('path');
const { createBot, PARTNER_COMMANDS } = require('./bot/bot');
const { LocalStorage } = require('./storage/LocalStorage');
const { scheduleCleanup } = require('./cleanup');
const { run } = require('@grammyjs/runner');

const RESTART_DELAY_MS = 15000;

// If polling ever stops on an error (network outage, Telegram 409/5xx), log it,
// tell the admin group when possible, and start again. Never takes the process down.
function keepRunning(bot, cfg, conn) {
  let runner = null;
  let stopping = false;
  let lastCrash = 0; // alert only when a crash repeats within 5 min: a single one after a restart is normal
  const start = () => {
    runner = run(bot, { runner: { fetch: { allowed_updates: ['message', 'callback_query', 'my_chat_member'] } } });
    console.log('[partners] bot polling started');
    runner.task().then(() => {
      if (stopping) return;
      console.warn('[partners] polling stopped, restarting in 15 s');
      setTimeout(start, RESTART_DELAY_MS);
    }, e => {
      if (stopping) return;
      const msg = String(e && e.message);
      console.error('[partners] polling crashed:', msg);
      // 409 = another copy of this bot polls with the same token (e.g. started twice,
      // or a local test copy next to the server). Say so plainly; transient 409s after a
      // quick restart heal on the next attempt.
      const text = /409/.test(msg)
        ? 'Бот партнёров: похоже, он запущен в двух местах с одним токеном (Telegram 409). Оставьте одну копию. Пробую снова через 15 с.'
        : 'Бот партнёров: сбой связи с Telegram, перезапускаюсь через 15 с.';
      const repeated = Date.now() - lastCrash < 5 * 60 * 1000;
      lastCrash = Date.now();
      if (repeated && cfg.adminChatId) bot.api.sendMessage(cfg.adminChatId, text).catch(() => {});
      setTimeout(start, RESTART_DELAY_MS);
    });
  };
  start();

  // pm2 restart/stop: finish the updates in flight, confirm them to Telegram
  // (so nothing is processed twice), close the database, then exit.
  const shutdown = async signal => {
    if (stopping) return;
    stopping = true;
    console.log(`[partners] ${signal}: stopping the bot`);
    const timeout = new Promise(resolve => setTimeout(resolve, 1500));
    await Promise.race([runner && runner.isRunning() ? runner.stop() : null, timeout]).catch(() => {});
    try { conn.close(); } catch (e) {}
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

function start() {
  try {
    const loaded = config.load();
    if (!loaded.ok) { console.warn(`[partners] not started: ${loaded.reason}`); return null; }
    const cfg = loaded.config;
    const conn = db.open(cfg.dbFile);
    const storage = new LocalStorage(cfg.photosDir);
    const bot = createBot({ cfg, store: createStore(conn), cars: createCars(conn), storage, saveAdminChat: config.saveAdminChatId });
    scheduleCleanup(conn, storage);
    bot.api.setMyCommands(PARTNER_COMMANDS).catch(e => console.warn('[partners] setMyCommands failed:', e.message));
    require('./bot/admin').publishCommands(bot.api, cfg.adminChatId);
    // Concurrent long polling (@grammyjs/runner). No drop_pending_updates: messages
    // partners sent during a restart are still handled.
    keepRunning(bot, cfg, conn);
    return bot;
  } catch (e) {
    console.error('[partners] failed to start:', e.message);
    return null;
  }
}

module.exports = { start };

if (require.main === module) {
  // Own process: a stray rejected promise is logged, not fatal; a real crash exits
  // and pm2 restarts the bot (restart_delay 5 s).
  process.on('unhandledRejection', err => console.error('[partners] unhandled rejection:', (err && err.stack) || err));
  if (!start()) process.exit(1);
}
