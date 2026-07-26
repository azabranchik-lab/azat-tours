// Shared store for leads and on-site chat. Plain JSON files so the HTTP server
// (server.js) and the bot (bot.js) — two processes — can both read/write.
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./fsx');

const DIR = path.join(__dirname, '..', 'content');
const LEADS = path.join(DIR, 'leads.json');
const CHATS = path.join(DIR, 'chats.json');

function ensure() { fs.mkdirSync(DIR, { recursive: true }); }
function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function write(file, data) { ensure(); writeFileAtomic(file, JSON.stringify(data, null, 2)); }

// ---------- leads ----------
const MAX_LEADS = 500, MAX_CHATS = 300;
function addLead(lead) {
  const leads = read(LEADS, []);
  const rec = Object.assign({ id: Date.now(), ts: new Date().toISOString() }, lead);
  leads.unshift(rec);
  if (leads.length > MAX_LEADS) leads.length = MAX_LEADS; // keep the most recent, cap file growth
  write(LEADS, leads);
  return rec;
}
// Keep only the most-recently-active chats so chats.json can't grow forever.
function trimChats(all) {
  const keys = Object.keys(all);
  if (keys.length <= MAX_CHATS) return all;
  const lastTs = c => (c.messages && c.messages.length ? c.messages[c.messages.length - 1].ts : c.created) || '';
  const keep = new Set(keys.sort((a, b) => lastTs(all[b]).localeCompare(lastTs(all[a]))).slice(0, MAX_CHATS));
  const out = {};
  for (const k of keys) if (keep.has(k)) out[k] = all[k];
  return out;
}
function listLeads(n = 15) { return read(LEADS, []).slice(0, n); }
function getLead(id) { return read(LEADS, []).find(l => String(l.id) === String(id)) || null; }
function markLeadHandled(id) {
  const leads = read(LEADS, []);
  const l = leads.find(x => String(x.id) === String(id));
  if (l && !l.handled) { l.handled = true; l.handledAt = new Date().toISOString(); write(LEADS, leads); }
  return l;
}

// ---------- chats ----------
// chats.json = { [sid]: { sid, name, email, created, messages:[{from:'user'|'owner', text, ts}] } }
function getChat(sid) { return read(CHATS, {})[sid] || null; }
function ensureChat(sid, fields) {
  const all = read(CHATS, {});
  if (!all[sid]) all[sid] = { sid, name: '', email: '', created: new Date().toISOString(), messages: [] };
  Object.assign(all[sid], Object.fromEntries(Object.entries(fields || {}).filter(([k, v]) => v)));
  write(CHATS, trimChats(all));
  return all[sid];
}
function addMessage(sid, from, text) {
  const all = read(CHATS, {});
  if (!all[sid]) all[sid] = { sid, name: '', email: '', created: new Date().toISOString(), messages: [] };
  all[sid].messages.push({ from, text, ts: new Date().toISOString() });
  write(CHATS, trimChats(all));
  return all[sid];
}
function listOpenChats(n = 15) {
  const all = read(CHATS, {});
  return Object.values(all).sort((a, b) => (b.messages.at(-1)?.ts || '').localeCompare(a.messages.at(-1)?.ts || '')).slice(0, n);
}

module.exports = { addLead, listLeads, getLead, markLeadHandled, getChat, ensureChat, addMessage, listOpenChats, LEADS, CHATS };
