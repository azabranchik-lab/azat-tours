// A shared secret for previewing drafts on the live site, derived from the bot
// token so the owner sets nothing and the server and bot agree on the same
// value. An attacker can't guess it without the token. Empty when no token
// (preview disabled). Used by server.js (gate) and bot.js (build the link).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let token = process.env.BOT_TOKEN || '';
try { token = token || (JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')).token || ''); } catch (e) {}

module.exports = token ? crypto.createHash('sha256').update('azat-preview:' + token).digest('hex').slice(0, 24) : '';
