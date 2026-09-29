// Single entry point for hosting: runs the website+API server, the Telegram admin
// bot AND the car-partners bot in one Node process.
//   Local:  node start.js
//   Prod:   set env BOT_TOKEN, OWNER_ID, PORT — then `node start.js`
// A stray promise rejection anywhere is logged, not fatal: it must never take the
// website down together with a bot. (Real crashes still exit and pm2 restarts us.)
process.on('unhandledRejection', err => console.error('[process] unhandled rejection:', err && err.stack || err));

require('./server');
require('./bot');
require('./partners').start(); // no-op (with a log line) until partners.token is in config.json
console.log('▶ Azat Tours: site + API + Telegram bots started.');
