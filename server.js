// Static server + lightweight API for leads and on-site chat.
// Serves the website AND exposes /api/lead and /api/chat, notifying the owner on Telegram.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
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

function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

// read a JSON body with a hard size cap; resolves null if too large
function readBody(req, maxBytes = 20000) {
  return new Promise(resolve => {
    let b = '', tooBig = false;
    req.on('data', c => { if (tooBig) return; b += c; if (b.length > maxBytes) tooBig = true; }); // stop buffering past cap, keep draining
    req.on('end', () => { if (tooBig) return resolve(null); try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve(null));
  });
}

// ---- per-IP rate limiting (in-memory, fixed window) ----
const rlHits = new Map();
function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket.remoteAddress || 'unknown';
}
function rateLimit(ip, bucket, max, windowMs) {
  const key = bucket + '|' + ip, now = Date.now();
  let e = rlHits.get(key);
  if (!e || now > e.reset) { e = { count: 0, reset: now + windowMs }; rlHits.set(key, e); }
  e.count++;
  if (rlHits.size > 5000) { for (const [k, v] of rlHits) if (now > v.reset) rlHits.delete(k); }
  return e.count <= max;
}

// ---- lead sanitisation (whitelist + length caps) ----
const LEAD_CAPS = { tour: 200, name: 120, email: 160, people: 20, dates: 120, whatsapp: 40, msg: 4000, trip_summary: 4000 };
function cleanLead(b) {
  const out = {};
  for (const [k, cap] of Object.entries(LEAD_CAPS)) {
    if (b[k] != null && b[k] !== '') out[k] = String(b[k]).trim().slice(0, cap);
  }
  return out;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;

  // ---------- API ----------
  if (p.startsWith('/api/')) {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    // new lead
    if (p === '/api/lead' && req.method === 'POST') {
      const b = await readBody(req);
      if (b === null) return sendJson(res, 413, { ok: false, error: 'too_large' });
      if (b.botcheck) return sendJson(res, 200, { ok: true }); // honeypot
      if (!rateLimit(clientIp(req), 'lead', 5, 10 * 60 * 1000)) return sendJson(res, 429, { ok: false, error: 'rate_limited' });
      const lead = cleanLead(b);
      if (!lead.email || !EMAIL_RE.test(lead.email)) return sendJson(res, 400, { ok: false, error: 'bad_email' });
      const rec = store.addLead(lead);
      const lines = [
        '🔔 <b>New lead from the website</b>',
        lead.tour ? `🏔 ${esc(lead.tour)}` : '',
        `👤 ${esc(lead.name || '—')}`,
        `✉️ ${esc(lead.email || '—')}`,
        lead.people ? `👥 ${esc(lead.people)} traveller(s)` : '',
        lead.dates ? `📅 ${esc(lead.dates)}` : '',
        lead.whatsapp ? `📱 ${esc(lead.whatsapp)}` : '',
        lead.msg ? `💬 ${esc(lead.msg)}` : '',
        lead.trip_summary ? `\n${esc(lead.trip_summary)}` : ''
      ].filter(Boolean);
      await tg('sendMessage', { chat_id: OWNER_ID, text: lines.join('\n'), parse_mode: 'HTML' });
      return sendJson(res, 200, { ok: true, id: rec.id });
    }

    // visitor sends a chat message
    if (p === '/api/chat' && req.method === 'POST') {
      const b = await readBody(req);
      if (b === null) return sendJson(res, 413, { ok: false, error: 'too_large' });
      const sid = String(b.sid || '').slice(0, 40);
      const text = String(b.text || '').slice(0, 2000).trim();
      if (!sid || !text) return sendJson(res, 400, { ok: false });
      if (!rateLimit(clientIp(req), 'chat', 30, 10 * 60 * 1000)) return sendJson(res, 429, { ok: false, error: 'rate_limited' });
      const name = String(b.name || '').slice(0, 120).trim();
      const email = String(b.email || '').slice(0, 160).trim();
      store.ensureChat(sid, { name, email });
      store.addMessage(sid, 'user', text);
      const who = name ? `${esc(name)}` : 'a visitor';
      await tg('sendMessage', {
        chat_id: OWNER_ID, parse_mode: 'HTML',
        text: `💬 <b>Question from ${who}</b>${email ? ` (${esc(email)})` : ''}\n\n${esc(text)}\n\n<i>Reply to this message to answer on the site.</i>\n#chat ${sid}`
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
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404 Not Found</h1>'); }
    const type = TYPES[path.extname(filePath)] || 'application/octet-stream';
    const etag = '"' + st.size.toString(36) + '-' + Math.round(st.mtimeMs).toString(36) + '"';
    const headers = {
      'Content-Type': type,
      'ETag': etag,
      'Last-Modified': st.mtime.toUTCString(),
      // images have unique/stable names → cache long; HTML/JS/CSS/data revalidate so deploys & bot edits show immediately
      'Cache-Control': /^image\//.test(type) ? 'public, max-age=604800' : 'no-cache'
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    fs.readFile(filePath, (e, data) => {
      if (e) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404 Not Found</h1>'); }
      const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      const compressible = /text\/|javascript|json|svg/.test(type);
      if (acceptsGzip && compressible && data.length > 1024) {
        zlib.gzip(data, (ge, gz) => {
          if (ge) { res.writeHead(200, headers); return res.end(data); }
          res.writeHead(200, Object.assign({ 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' }, headers));
          res.end(gz);
        });
      } else { res.writeHead(200, headers); res.end(data); }
    });
  });
});

server.listen(PORT, () => console.log(`Azat Tours site + API running at http://localhost:${PORT}`));
