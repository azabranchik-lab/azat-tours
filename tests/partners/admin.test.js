// Admin setup helpers in the moderation group.
const test = require('node:test');
const assert = require('node:assert');
const { setup, OWNER } = require('./helpers');

function groupCommand(s, fromId, text = '/chatid') {
  return s.bot.handleUpdate({ update_id: 900 + fromId % 50, message: {
    message_id: 5, date: 0, text, entities: [{ type: 'bot_command', offset: 0, length: text.length }],
    chat: { id: -1001234567890, type: 'supergroup', title: 'Модерация' },
    from: { id: fromId, is_bot: false, first_name: 'X' }
  } });
}

test('/chatid in a group: shows the id to the owner only', async () => {
  const s = setup();
  await groupCommand(s, 777);                           // not an admin
  assert.strictEqual(s.calls.filter(c => c.method === 'sendMessage').length, 0);
  await groupCommand(s, OWNER);
  const reply = s.calls.find(c => c.method === 'sendMessage').payload;
  assert.strictEqual(reply.chat_id, -1001234567890);
  assert.match(reply.text, /ID этой группы: -1001234567890\nВпишите его/);
});

test('/chatid confirms when the group is already configured', async () => {
  const s = setup(undefined, { adminChatId: -1001234567890 });
  await groupCommand(s, OWNER);
  assert.match(s.calls.find(c => c.method === 'sendMessage').payload.text, /Уже прописан/);
});
