// Static server + lightweight API for leads and on-site chat.
// Serves the website AND exposes /api/lead and /api/chat, notifying the owner on Telegram.
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');

const ROOT = __dirname;
const PORT = process.env.PORT || 5173;

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (e) {}
const TOKEN = process.env.BOT_TOKEN || cfg.token;
const OWNER_ID = Number(process.env.OWNER_ID || cfg.ownerId) || 0;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

// ---- Telegram helper ----
async function tg(method, payload) {
  if (!TOKEN || !OWNER_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
  } catch (e) { console.error('tg send failed', e.message); }
}
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;

  // ---------- API ----------
  if (p.startsWith('/api/')) {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }

    // new lead
    if (p === '/api/lead' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.botcheck) return sendJson(res, 200, { ok: true }); // honeypot
      const rec = store.addLead(b);
      const lines = [
        '🔔 <b>New lead from the website</b>',
        b.tour ? `🏔 ${esc(b.tour)}` : '',
        `👤 ${esc(b.name || '—')}`,
        `✉️ ${esc(b.email || '—')}`,
        b.people ? `👥 ${esc(b.people)} traveller(s)` : '',
        b.dates ? `📅 ${esc(b.dates)}` : '',
        b.whatsapp ? `📱 ${esc(b.whatsapp)}` : '',
        b.msg ? `💬 ${esc(b.msg)}` : '',
        b.trip_summary ? `\n${esc(b.trip_summary)}` : ''
      ].filter(Boolean);
      await tg('sendMessage', { chat_id: OWNER_ID, text: lines.join('\n'), parse_mode: 'HTML' });
      return sendJson(res, 200, { ok: true, id: rec.id });
    }

    // visitor sends a chat message
    if (p === '/api/chat' && req.method === 'POST') {
      const b = await readBody(req);
      const sid = String(b.sid || '').slice(0, 40);
      if (!sid || !b.text) return sendJson(res, 400, { ok: false });
      store.ensureChat(sid, { name: b.name, email: b.email });
      store.addMessage(sid, 'user', String(b.text).slice(0, 2000));
      const who = b.name ? `${esc(b.name)}` : 'a visitor';
      await tg('sendMessage', {
        chat_id: OWNER_ID, parse_mode: 'HTML',
        text: `💬 <b>Question from ${who}</b>${b.email ? ` (${esc(b.email)})` : ''}\n\n${esc(b.text)}\n\n<i>Reply to this message to answer on the site.</i>\n#chat ${sid}`
      });
      return sendJson(res, 200, { ok: true });
    }

    // widget polls for the conversation
    if (p === '/api/chat' && req.method === 'GET') {
      const sid = String(u.searchParams.get('sid') || '').slice(0, 40);
      const chat = store.getChat(sid);
      return sendJson(res, 200, { ok: true, messages: chat ? chat.messages : [] });
    }

    return sendJson(res, 404, { ok: false, error: 'unknown endpoint' });
  }

  // ---------- static ----------
  let urlPath = decodeURIComponent(p);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404 Not Found</h1>'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Alatoo site + API running at http://localhost:${PORT}`));
