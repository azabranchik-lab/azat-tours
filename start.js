// Single entry point for hosting: runs the website+API server AND the Telegram bot
// in one Node process. Both modules auto-start on require.
//   Local:  node start.js
//   Prod:   set env BOT_TOKEN, OWNER_ID, PORT — then `node start.js`
require('./server');
require('./bot');
console.log('▶ Azat Tours: site + API + Telegram bot started.');
