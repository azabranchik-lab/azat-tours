// Admin setup helpers in the moderation group.
const test = require('node:test');
const assert = require('node:assert');
const { setup, OWNER } = require('./helpers');

let uid = 900;
function groupCommand(s, fromId, text = '/chatid') {
  return s.bot.handleUpdate({ update_id: uid++, message: {
    message_id: 5, date: 0, text, entities: [{ type: 'bot_command', offset: 0, length: text.length }],
    chat: { id: -1001234567890, type: 'supergroup', title: 'Модерация' },
    from: { id: fromId, is_bot: false, first_name: 'X' }
  } });
}

const replies = s => s.calls.filter(c => c.method === 'sendMessage').map(c => c.payload);

test('/chatid: owner only; connects the group when none is set', async () => {
  const saved = [];
  const s = setup(undefined, {}, null, { saveAdminChat: id => saved.push(id) });
  await groupCommand(s, 777);                           // not an admin: silence
  assert.strictEqual(replies(s).length, 0);

  await groupCommand(s, OWNER);
  assert.strictEqual(replies(s)[0].chat_id, -1001234567890);
  assert.match(replies(s)[0].text, /ID этой группы: -1001234567890\nГруппа подключена/);
  assert.deepStrictEqual(saved, [-1001234567890]);

  await groupCommand(s, OWNER);                          // second time: already connected
  assert.match(replies(s).at(-1).text, /уже подключена/);
  assert.strictEqual(saved.length, 1);
});

test('/chatid never silently switches to another group', async () => {
  const saved = [];
  const s = setup(undefined, { adminChatId: -100999 }, null, { saveAdminChat: id => saved.push(id) });
  await groupCommand(s, OWNER);
  assert.match(replies(s)[0].text, /подключена другая группа \(-100999\)/);
  assert.deepStrictEqual(saved, []);
});

test('saveAdminChatId keeps every other config key (and never touches the site config)', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pcfg-')), 'config.json');
  fs.writeFileSync(file, JSON.stringify({ token: '1:abc', ownerId: 5, adminChatId: 0, siteUrl: 'https://x' }));
  const config = require('../config');
  config.saveAdminChatId(-42, file);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { token: '1:abc', ownerId: 5, adminChatId: -42, siteUrl: 'https://x' });
  const loaded = config.load(file);
  assert.ok(loaded.ok);
  assert.strictEqual(loaded.config.adminChatId, -42);
  assert.deepStrictEqual(loaded.config.adminIds, [5]);
  assert.ok(loaded.config.dbFile.startsWith(config.DATA_DIR));
  assert.ok(!/content/.test(loaded.config.dbFile), 'data lives in partners/data, not the site content/');
});
