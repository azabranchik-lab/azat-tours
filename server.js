// Static server + lightweight API for leads and on-site chat.
// Serves the website AND exposes /api/lead and /api/chat, notifying the owner on Telegram.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const store = require('./lib/store');
const content = require('./lib/content'); // read-only here: per-slug meta for tour.html/post.html
const { waLink } = require('./lib/lead'); // "Reply on WhatsApp" button on the lead notification

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

// ---- per-slug <head> meta for tour.html / post.html ----
// WhatsApp/Facebook/Telegram scrapers don't run JS, so the og tags that
// tour-detail.js / post-render.js set client-side never reach link previews.
// Mirror the same title/description/og formulas into the served HTML.
// Returns null when the slug is unknown or content JSON is unavailable
// (caller then serves the file unmodified).
// tours.json is ~800KB; don't re-parse it on every tour.html hit.
// mtime-keyed cache stays fresh when the bot edits content live.
const _contentCache = {};
function cachedLoad(jsonPath, loader) {
  const mtime = fs.statSync(jsonPath).mtimeMs;
  const c = _contentCache[jsonPath];
  if (c && c.mtime === mtime) return c.data;
  const data = loader() || [];
  _contentCache[jsonPath] = { mtime, data };
  return data;
}
// Make a possibly site-relative image path absolute (social scrapers + JSON-LD need it).
const ORIGIN = 'https://azattours.com';
const abs = u => u ? (/^https?:\/\//.test(u) ? u : ORIGIN + '/' + String(u).replace(/^\/+/, '')) : '';

// SEO <title> builders. Names are already clean (scripts/normalize-tour-names.js),
// so we only avoid a double "Kyrgyzstan"/redundant suffix and keep titles ≤60:
// priority is the keyword-rich name > country hint > brand.
function tourTitle(name) {
  let base = name;
  if (!/kyrgyzstan/i.test(base) && base.length + 12 <= 60) base += ', Kyrgyzstan';
  const withBrand = base + ' | Azat Tours';
  return withBrand.length <= 60 ? withBrand : base;
}
function postTitle(title) { return title + ' | Azat Tours'; } // was " | Azat Tours Kyrgyzstan" (too long)

// Per-tour FAQ from real fields. KEEP IN SYNC with tour-detail.js tourFaqs() —
// this feeds the SSR FAQPage schema and must match the visible copy the client renders.
function fmtActivities(a) {
  return String(a).split(',').map(s => {
    const m = s.match(/(.+?)\s*-\s*(\d+)\s*days?/i);
    return m ? m[2] + ' days ' + m[1].trim() : s.trim();
  }).join(' and ');
}
function tourFaqs(t) {
  const out = [];
  const dur = t.duration || (t.days ? t.days + ' days' : '');
  const start = t.start_from || 'Bishkek';
  if (dur) out.push(['How long is this tour?', 'It runs ' + dur + ', starting and ending in ' + start + '.']);
  if (t.season) out.push(['When is the best time to go?', 'The season runs ' + t.season + '. June to September brings the warmest days, and the high-pasture yurt camps are open.']);
  const pace = t.tour_speed ? t.tour_speed.charAt(0).toLowerCase() + t.tour_speed.slice(1) : '';
  if (pace || t.activities) {
    let a = "It's " + (pace || 'an active trip');
    if (t.activities) a += ', with ' + fmtActivities(t.activities);
    a += '. Good general fitness is enough, and there is no technical climbing.';
    out.push(['How fit do I need to be?', a]);
  }
  if ((t.tags || []).indexOf('horseback') >= 0 || /horse|combined/i.test(t.category || '')) {
    out.push(['Do I need horse-riding experience?', 'No. Our guides match each horse to your level and keep the first day gentle, so complete beginners ride this route every season.']);
  }
  if (t.accommodations) out.push(['Where will I stay?', 'A mix over the trip: ' + t.accommodations + '.']);
  return out;
}
function faqSchema(faqs) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } })) };
}

function buildSlugMeta(urlPath, slug) {
  try {
    if (urlPath === '/tour.html') {
      const t = cachedLoad(content.TOURS_JSON, content.loadTours).find(x => x.slug === slug);
      if (!t) return null;
      const desc = ((t.blurb && t.blurb.text) || t.summary || '').slice(0, 158);
      const url = ORIGIN + '/tour.html?slug=' + encodeURIComponent(slug);
      const image = abs((t.images && t.images[0]) || '');
      return {
        key: 'tour-' + slug, title: tourTitle(t.name),
        desc, ogType: 'website', image, url,
        jsonld: [
          { '@context': 'https://schema.org', '@type': 'TouristTrip', name: t.name, description: t.summary || desc,
            image: image || undefined, touristType: t.cats,
            itinerary: { '@type': 'ItemList', numberOfItems: (t.itinerary || []).length, itemListElement: (t.itinerary || []).map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.title })) },
            provider: { '@type': 'TravelAgency', name: 'Azat Tours Kyrgyzstan', url: ORIGIN } },
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
            { '@type': 'ListItem', position: 2, name: 'Tours', item: ORIGIN + '/tours.html' },
            { '@type': 'ListItem', position: 3, name: t.name, item: url } ] }
        ].concat(tourFaqs(t).length ? [faqSchema(tourFaqs(t))] : [])
      };
    }
    if (urlPath === '/post.html') {
      const po = cachedLoad(content.POSTS_JSON, content.loadPosts).find(x => x.slug === slug);
      if (!po) return null;
      const desc = String(po.excerpt || po.body || '').replace(/\s+/g, ' ').trim().slice(0, 158);
      const url = ORIGIN + '/post.html?slug=' + encodeURIComponent(slug);
      const image = abs(po.cover || '');
      return {
        key: 'post-' + slug, title: postTitle(po.title),
        desc, ogType: 'article', image, url,
        jsonld: [
          { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: po.title, description: desc,
            image: image || undefined, datePublished: po.date || undefined,
            author: { '@type': 'Person', name: po.author },
            publisher: { '@type': 'TravelAgency', name: 'Azat Tours Kyrgyzstan', url: ORIGIN },
            mainEntityOfPage: url },
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: ORIGIN + '/blog.html' },
            { '@type': 'ListItem', position: 3, name: po.title, item: url } ] }
        ]
      };
    }
  } catch (e) { /* content/*.json missing or malformed -> serve unmodified */ }
  return null;
}
function injectSlugMeta(html, m) {
  // A tour/post page reached without a valid slug is a thin duplicate of the first
  // item — keep it out of the index instead of serving a generic indexable page.
  if (m.noindex) return html.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
  const at = s => esc(s).replace(/"/g, '&quot;'); // attribute context needs quotes escaped too
  // JSON-LD for bots that don't run JS; escape "<" so a value can't close the script tag.
  const ld = m.jsonld
    ? `<script type="application/ld+json" data-ssr="1">${JSON.stringify(m.jsonld).replace(/</g, '\\u003c')}</script>\n`
    : '';
  const tags =
    `<meta name="description" content="${at(m.desc)}">\n` +
    `<meta property="og:type" content="${m.ogType}">\n` +
    `<meta property="og:title" content="${at(m.title)}">\n` +
    `<meta property="og:description" content="${at(m.desc)}">\n` +
    (m.image ? `<meta property="og:image" content="${at(m.image)}">\n` : '') +
    `<meta property="og:url" content="${at(m.url)}">\n` +
    `<meta name="twitter:card" content="summary_large_image">\n` +
    `<link rel="canonical" href="${at(m.url)}">\n` + ld;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description"[^>]*>\s*/i, '') // drop the shared static one; injected tag replaces it
    .replace('</head>', tags + '</head>');
}

// Branded 404 page (falls back to a bare heading if the file is missing).
function send404(res) {
  fs.readFile(path.join(PUBLIC, '404.html'), (e, d) => {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(e ? '<h1>404 Not Found</h1>' : d);
  });
}

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

    // per-slug meta for tour/post pages: without the slug in the ETag a 304
    // could confirm another slug's cached <head>
    const slug = u.searchParams.get('slug');
    const isItemPage = urlPath === '/tour.html' || urlPath === '/post.html';
    let slugMeta = slug ? buildSlugMeta(urlPath, slug) : null;
    // tour/post page with no valid slug (bare or unknown) → noindex, not a generic dupe
    if (isItemPage && !slugMeta) slugMeta = { noindex: true, key: 'noindex' };
    const etag = '"' + servedStat.size.toString(36) + '-' + Math.round(servedStat.mtimeMs).toString(36) + (slugMeta ? '-' + slugMeta.key : '') + '"';
    const headers = {
      'Content-Type': type,
      'ETag': etag,
      'Last-Modified': servedStat.mtime.toUTCString(),
      // images have unique/stable names → cache long; HTML/JS/CSS/data revalidate so deploys & bot edits show immediately
      'Cache-Control': /^image\//.test(type) ? 'public, max-age=604800' : 'no-cache'
    };
    // Negotiable image URLs vary by Accept so shared caches key avif/webp/jpeg apart.
    if (negotiable) headers['Vary'] = 'Accept';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    fs.readFile(served, (e, data) => {
      if (e) { return send404(res); }
      if (slugMeta) data = Buffer.from(injectSlugMeta(data.toString('utf8'), slugMeta), 'utf8');
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
