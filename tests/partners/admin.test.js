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

test('saveAdminChatId keeps every other config key', () => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', '..', 'config.json');
  const before = fs.readFileSync(file, 'utf8');
  try {
    require('../../partners/config').saveAdminChatId(-42);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    const orig = JSON.parse(before);
    assert.strictEqual(after.partners.adminChatId, -42);
    assert.strictEqual(after.partners.token, orig.partners && orig.partners.token);
    assert.strictEqual(after.token, orig.token);
    assert.strictEqual(after.ownerId, orig.ownerId);
  } finally {
    fs.writeFileSync(file, before);                      // restore the real config
  }
});
