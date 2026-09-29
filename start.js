// Entry point for the website+API server and the Telegram admin bot (one process).
// The car-partners bot runs as its OWN process (partners/index.js, pm2 app
// "azat-partners"), so nothing it does can slow down or crash the site.
//   Local:  node start.js
//   Prod:   set env BOT_TOKEN, OWNER_ID, PORT — then `node start.js`
// A stray promise rejection anywhere is logged, not fatal: it must never take the
// website down. (Real crashes still exit and pm2 restarts us.)
process.on('unhandledRejection', err => console.error('[process] unhandled rejection:', err && err.stack || err));

require('./server');
require('./bot');
console.log('▶ Azat Tours: site + API + admin bot started.');
