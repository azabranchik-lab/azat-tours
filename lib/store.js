// Shared store for leads and on-site chat. Plain JSON files so the HTTP server
// (server.js) and the bot (bot.js) — two processes — can both read/write.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content');
const LEADS = path.join(DIR, 'leads.json');
const CHATS = path.join(DIR, 'chats.json');

function ensure() { fs.mkdirSync(DIR, { recursive: true }); }
function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function write(file, data) { ensure(); fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// ---------- leads ----------
function addLead(lead) {
  const leads = read(LEADS, []);
  const rec = Object.assign({ id: Date.now(), ts: new Date().toISOString() }, lead);
  leads.unshift(rec);
  write(LEADS, leads);
  return rec;
}
function listLeads(n = 15) { return read(LEADS, []).slice(0, n); }

// ---------- chats ----------
// chats.json = { [sid]: { sid, name, email, created, messages:[{from:'user'|'owner', text, ts}] } }
function getChat(sid) { return read(CHATS, {})[sid] || null; }
function ensureChat(sid, fields) {
  const all = read(CHATS, {});
  if (!all[sid]) all[sid] = { sid, name: '', email: '', created: new Date().toISOString(), messages: [] };
  Object.assign(all[sid], Object.fromEntries(Object.entries(fields || {}).filter(([k, v]) => v)));
  write(CHATS, all);
  return all[sid];
}
function addMessage(sid, from, text) {
  const all = read(CHATS, {});
  if (!all[sid]) all[sid] = { sid, name: '', email: '', created: new Date().toISOString(), messages: [] };
  all[sid].messages.push({ from, text, ts: new Date().toISOString() });
  write(CHATS, all);
  return all[sid];
}
function listOpenChats(n = 15) {
  const all = read(CHATS, {});
  return Object.values(all).sort((a, b) => (b.messages.at(-1)?.ts || '').localeCompare(a.messages.at(-1)?.ts || '')).slice(0, n);
}

module.exports = { addLead, listLeads, getChat, ensureChat, addMessage, listOpenChats, LEADS, CHATS };
