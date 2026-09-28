// Single entry point for hosting: runs the website+API server, the Telegram admin
// bot AND the car-partners bot in one Node process.
//   Local:  node start.js
//   Prod:   set env BOT_TOKEN, OWNER_ID, PORT — then `node start.js`
require('./server');
require('./bot');
require('./partners').start(); // no-op (with a log line) until partners.token is in config.json
console.log('▶ Azat Tours: site + API + Telegram bots started.');
