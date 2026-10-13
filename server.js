// Static server + lightweight API for leads and on-site chat.
// Serves the website AND exposes /api/lead and /api/chat, notifying the owner on Telegram.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const store = require('./lib/store');
const content = require('./lib/content'); // read-only here: draft-inclusive data for the bot's preview
const pages = require('./lib/pages');     // server-rendered tour/post/list pages + sitemap
const { waLink } = require('./lib/lead'); // "Reply on WhatsApp" button on the lead notification
const PREVIEW_KEY = require('./lib/previewkey'); // secret gate for previewing drafts on the live site

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public'); // website assets are served from here
const PORT = process.env.PORT || 5173;

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (e) {}
const TOKEN = process.env.BOT_TOKEN || cfg.token;
const OWNER_ID = Number(process.env.OWNER_ID || cfg.ownerId) || 0;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

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

// Branded 404 page (falls back to a bare heading if the file is missing).
function send404(res) {
  let body = null;
  try { body = pages.staticPage('404.html'); } catch (e) { console.error('404 page failed', e.message); }
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body || '<h1>404 Not Found</h1>');
}

// Permanent redirect. Cached for an hour only, so a wrong mapping can still be fixed.
function redirect(res, location) {
  res.writeHead(301, { Location: location, 'Cache-Control': 'public, max-age=3600' });
  res.end();
}

// If-None-Match may carry a weak prefix (a proxy that compresses adds W/) or a list.
function etagMatches(req, etag) {
  return String(req.headers['if-none-match'] || '').split(',').some(t => t.trim().replace(/^W\//, '') === etag);
}

// Send a body with optional gzip.
function respond(req, res, data, headers, type) {
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const compressible = /text\/|javascript|json|svg|xml/.test(type);
  if (acceptsGzip && compressible && data.length > 1024) {
    zlib.gzip(data, (ge, gz) => {
      if (ge) { res.writeHead(200, headers); return res.end(data); }
      res.writeHead(200, Object.assign({ 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' }, headers));
      res.end(gz);
    });
  } else { res.writeHead(200, headers); res.end(data); }
}

// Send a server-rendered page (lib/pages.js). The ETag follows the content and
// template versions, so bot edits and deploys show immediately.
function sendPage(req, res, body, key, opts) {
  if (body == null) return send404(res);
  const type = (opts && opts.type) || 'text/html; charset=utf-8';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
  if (opts && opts.robots) headers['X-Robots-Tag'] = opts.robots;
  if (opts && opts.preview) { headers['Cache-Control'] = 'no-store'; headers['X-Robots-Tag'] = 'noindex'; }
  else {
    headers.ETag = '"' + pages.version() + '-' + key + '"';
    if (etagMatches(req, headers.ETag)) { res.writeHead(304, headers); return res.end(); }
  }
  respond(req, res, Buffer.from(body, 'utf8'), headers, type);
}

// Clean URLs, plus 301s from every old address:
//   /tours/  /tours/<slug>/  /blog/  /blog/<slug>/  /sitemap.xml
//   tour.html?slug=OLD -> /tours/NEW/   post.html?slug=X -> /blog/X/
//   tours.html -> /tours/   blog.html -> /blog/   index.html -> /
// Returns true when the request was handled.
function routePage(req, res, u, urlPath) {
  const preview = !!(PREVIEW_KEY && u.searchParams.get('preview') === PREVIEW_KEY);
  const slug = u.searchParams.get('slug');

  if (urlPath === '/tour.html') {
    // the bot's "Preview on site" link for a draft (secret key, never indexed)
    if (preview && slug) { sendPage(req, res, pages.tourPage(slug, { preview: true }), '', { preview: true }); return true; }
    const id = u.searchParams.get('id');
    if (!slug && !id) { redirect(res, '/tours/'); return true; }
    const target = slug ? (pages.hasTour(slug) ? slug : pages.resolveTourSlug(slug)) : pages.tourIdSlug(id);
    if (target && pages.hasTour(target)) redirect(res, '/tours/' + target + '/'); else send404(res);
    return true;
  }
  if (urlPath === '/post.html') {
    if (preview && slug) { sendPage(req, res, pages.postPage(slug, { preview: true }), '', { preview: true }); return true; }
    if (!slug) { redirect(res, '/blog/'); return true; }
    if (pages.hasPost(slug)) redirect(res, '/blog/' + slug + '/'); else send404(res);
    return true;
  }
  if (urlPath === '/tours.html') { redirect(res, '/tours/' + u.search); return true; }
  if (urlPath === '/blog.html') { redirect(res, '/blog/' + u.search); return true; }
  if (u.pathname === '/index.html') { redirect(res, '/' + u.search); return true; }
  if (urlPath === '/sitemap.xml') { sendPage(req, res, pages.sitemapXml(), 'sitemap', { type: 'application/xml; charset=utf-8' }); return true; }

  // Plain-text versions for AI assistants (lib/text-pages.js). The Markdown copies
  // of single pages are kept out of search indexes: the HTML page is the one to rank.
  const TEXT = { type: 'text/plain; charset=utf-8' };
  const MD = { type: 'text/markdown; charset=utf-8', robots: 'noindex' };
  if (urlPath === '/llms.txt') { sendPage(req, res, pages.llmsTxt(), 'llms', TEXT); return true; }
  if (urlPath === '/llms-full.txt') { sendPage(req, res, pages.llmsFullTxt(), 'llms-full', TEXT); return true; }
  const md = urlPath.match(/^\/(tours|blog)\/([a-z0-9-]+)\.md$/);
  if (md) { sendPage(req, res, md[1] === 'tours' ? pages.tourMarkdown(md[2]) : pages.postMarkdown(md[2]), 'md-' + md[2], MD); return true; }

  // Every other page of the site: navigation (and the home page's tour picks) in the HTML.
  const file = urlPath.match(/^\/([a-z0-9-]+\.html)$/);
  if (file) { const html = pages.staticPage(file[1]); if (html != null) { sendPage(req, res, html, 'static-' + file[1]); return true; } }

  const m = urlPath.match(/^\/(tours|blog)(?:\/([^/]*)(\/?))?$/);
  if (!m) return false;
  const [, section, item, slash] = m;
  if (item === '' && slash) { send404(res); return true; }                                                // "/tours//"
  if (item === undefined) { redirect(res, '/' + section + '/' + u.search); return true; }               // /tours -> /tours/
  if (item === '') { sendPage(req, res, section === 'tours' ? pages.toursIndex() : pages.blogIndex(), section); return true; }
  if (!/^[a-z0-9-]+$/.test(item)) { send404(res); return true; }
  if (section === 'tours') {
    // A live tour always wins; the rename map is only for addresses that no longer exist.
    if (!pages.hasTour(item)) {
      const target = pages.resolveTourSlug(item);                                                        // renamed or retired tour
      if (target !== item && pages.hasTour(target)) redirect(res, '/tours/' + target + '/'); else send404(res);
      return true;
    }
    if (!slash) { redirect(res, '/tours/' + item + '/'); return true; }
    sendPage(req, res, pages.tourPage(item), 'tour-' + item);
    return true;
  }
  if (!pages.hasPost(item)) { send404(res); return true; }
  if (!slash) { redirect(res, '/blog/' + item + '/'); return true; }
  sendPage(req, res, pages.postPage(item), 'post-' + item);
  return true;
}

const server = http.createServer(async (req, res) => {
  let u;
  try { u = new URL(req.url, `http://localhost:${PORT}`); }
  catch { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }   // e.g. "GET //"

  // Browsers that have seen the site over HTTPS keep using it; no MIME sniffing.
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // One host: www.azattours.com serves the same pages, so send it to the canonical one.
  if (/^www\.azattours\.com(:\d+)?$/i.test(req.headers.host || '')) return redirect(res, 'https://azattours.com' + req.url);
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
        `✉️ <code>${esc(lead.email || '—')}</code>`,
        lead.people ? `👥 ${esc(lead.people)} traveller(s)` : '',
        lead.dates ? `📅 ${esc(lead.dates)}` : '',
        lead.whatsapp ? `📱 <code>${esc(lead.whatsapp)}</code>` : '',
        lead.msg ? `💬 ${esc(lead.msg)}` : '',
        lead.trip_summary ? `\n${esc(lead.trip_summary)}` : ''
      ].filter(Boolean);
      // Action buttons: WhatsApp (only if they left a number) + mark handled.
      // The bot (bot.js) handles the l:done:<id> callback; same lead id.
      const wa = waLink(lead);
      const row = [];
      if (wa) row.push({ text: '💬 Reply on WhatsApp', url: wa });
      row.push({ text: '✅ Mark handled', callback_data: `l:done:${rec.id}` });
      await tg('sendMessage', { chat_id: OWNER_ID, text: lines.join('\n'), parse_mode: 'HTML', reply_markup: { inline_keyboard: [row] } });
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
      const page = String(b.page || '').slice(0, 300).trim();
      const pageTitle = String(b.pageTitle || '').slice(0, 200).trim();
      // only announce the page when it changed, so a thread isn't repeated on every message
      const prevPage = (store.getChat(sid) || {}).page || '';
      store.ensureChat(sid, { name, email, page, pageTitle });
      store.addMessage(sid, 'user', text);
      const who = name ? `${esc(name)}` : 'a visitor';
      const where = page && page !== prevPage ? `\n\n<i>📍 ${esc(pageTitle || page)}\n${esc(page)}</i>` : '';
      await tg('sendMessage', {
        chat_id: OWNER_ID, parse_mode: 'HTML',
        text: `💬 <b>Question from ${who}</b>${email ? ` (${esc(email)})` : ''}\n\n${esc(text)}${where}\n\n<i>Reply to this message to answer on the site.</i>\n#chat ${sid}`
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
  let urlPath;
  try { urlPath = decodeURIComponent(p); }
  catch { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }
  if (urlPath === '/') urlPath = '/index.html';

  // Draft preview: serve draft-inclusive data ONLY with the secret key. Without
  // it, the public data files stay drafts-free. Not cached, not indexed.
  if (PREVIEW_KEY && (urlPath === '/posts-data.js' || urlPath === '/tours-data.js') && u.searchParams.get('key') === PREVIEW_KEY) {
    const isPosts = urlPath === '/posts-data.js';
    const list = isPosts ? content.loadPosts() : content.loadTours();
    const body = (isPosts ? 'window.POSTS = ' : 'window.TOURS = ') + JSON.stringify(list) + ';\n';
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    return res.end(body);
  }

  try { if (routePage(req, res, u, urlPath)) return; }
  catch (e) { console.error('page render failed', urlPath, e); res.writeHead(500, { 'Content-Type': 'text/plain' }); return res.end('Server error'); }

  const filePath = path.join(PUBLIC, urlPath);
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { return send404(res); }
    const ext0 = path.extname(filePath).toLowerCase();

    // Transparent AVIF/WebP negotiation: the DOM keeps requesting foo.jpg, but
    // when the browser advertises a modern format via Accept and a committed
    // `<file>.avif`/`.webp` sibling exists (built by scripts/build-image-formats.js),
    // serve that lighter file instead. No markup changes anywhere — only the
    // bytes on the wire differ, so layout/flow are untouched.
    let served = filePath, servedStat = st, type = TYPES[ext0] || 'application/octet-stream';
    const negotiable = ext0 === '.jpg' || ext0 === '.jpeg' || ext0 === '.png';
    if (negotiable) {
      const accept = req.headers.accept || '';
      const cand = [];
      if (/image\/avif/.test(accept)) cand.push(['.avif', 'image/avif']);
      if (/image\/webp/.test(accept)) cand.push(['.webp', 'image/webp']);
      for (const [vext, vtype] of cand) {
        try {
          const vs = fs.statSync(filePath + vext);
          if (vs.isFile()) { served = filePath + vext; servedStat = vs; type = vtype; break; }
        } catch {}
      }
    }

    const etag = '"' + servedStat.size.toString(36) + '-' + Math.round(servedStat.mtimeMs).toString(36) + '"';
    const headers = {
      'Content-Type': type,
      'ETag': etag,
      'Last-Modified': servedStat.mtime.toUTCString(),
      // images have unique/stable names → cache long; HTML/JS/CSS/data revalidate so deploys & bot edits show immediately
      'Cache-Control': /^image\//.test(type) ? 'public, max-age=604800' : 'no-cache'
    };
    // Negotiable image URLs vary by Accept so shared caches key avif/webp/jpeg apart.
    if (negotiable) headers['Vary'] = 'Accept';
    if (etagMatches(req, etag)) { res.writeHead(304, headers); return res.end(); }
    fs.readFile(served, (e, data) => {
      if (e) { return send404(res); }
      respond(req, res, data, headers, type);
    });
  });
});

server.listen(PORT, () => console.log(`Azat Tours site + API running at http://localhost:${PORT}`));
