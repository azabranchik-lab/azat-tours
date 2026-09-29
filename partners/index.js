// Car-partners bot (docs/car-partners/SPEC.md). Started from start.js next to the
// site and the admin bot. Any failure here is logged and swallowed so the site
// and the admin bot keep running.
const config = require('./config');
const db = require('./db');
const { createStore } = require('./store');
const { createCars } = require('./cars');
const path = require('path');
const { createBot } = require('./bot/bot');
const { LocalStorage } = require('./storage/LocalStorage');
const { scheduleCleanup } = require('./cleanup');

function start() {
  try {
    const loaded = config.load();
    if (!loaded.ok) { console.warn(`[partners] not started: ${loaded.reason}`); return null; }
    const cfg = loaded.config;
    const conn = db.open(cfg.dbFile);
    const storage = new LocalStorage(path.join(path.dirname(cfg.dbFile), 'car-photos'));
    const bot = createBot({ cfg, store: createStore(conn), cars: createCars(conn), storage, saveAdminChat: config.saveAdminChatId });
    scheduleCleanup(conn, storage);
    bot.api.setMyCommands([
      { command: 'start', description: 'Главное меню' },
      { command: 'help', description: 'Помощь' }
    ]).catch(e => console.warn('[partners] setMyCommands failed:', e.message));
    // No drop_pending_updates: messages partners sent during a restart still get handled.
    bot.start({ onStart: me => console.log(`[partners] bot @${me.username} started`) })
      .catch(e => console.error('[partners] bot stopped:', e.message));
    return bot;
  } catch (e) {
    console.error('[partners] failed to start:', e.message);
    return null;
  }
}

module.exports = { start };

// `npm run partners` runs this bot alone (local testing with a separate token,
// without starting the admin bot that would clash with the server's polling).
if (require.main === module) {
  if (!start()) process.exit(1);
}
