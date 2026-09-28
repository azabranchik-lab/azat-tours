// Azat Tours Telegram admin bot — manage tours AND blog from your phone.
// Setup: put your token + ownerId in config.json (first /start auto-claims owner).
// Run:  node bot.js
const fs = require('fs');
const path = require('path');
const { Bot, InlineKeyboard, InputFile } = require('grammy');
const C = require('./lib/content');
const store = require('./lib/store');
const { waLink } = require('./lib/lead');
const ai = require('./lib/ai');
const PREVIEW_KEY = require('./lib/previewkey');
const { writeFileAtomic } = require('./lib/fsx');

// ---------- config ----------
const CONFIG_PATH = path.join(__dirname, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
const ORIGIN = cfg.origin || 'https://azattours.com';
const TOKEN = process.env.BOT_TOKEN || cfg.token;
let OWNER_ID = Number(process.env.OWNER_ID || cfg.ownerId) || 0;
// Only touch ownerId: re-read the file and keep every other key (origin, anthropicApiKey,
// partner-bot settings…). Never persist a token that came from env.
function setOwner(id) {
  OWNER_ID = id;
  try {
    let cur = {};
    try { cur = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
    cur.ownerId = id;
    writeFileAtomic(CONFIG_PATH, JSON.stringify(cur, null, 2));
  } catch (e) {}
}
if (!TOKEN || TOKEN.includes('PASTE-')) {
  console.error('\n⚠️  No bot token. Put it in config.json, then run: node bot.js\n');
  process.exit(1);
}

const bot = new Bot(TOKEN);
const sessions = new Map(); // userId -> state

const TOUR_CATS = ['Combined', 'Horse riding', 'Road trip', 'Off-the-beaten-path', 'Winter tours'];
const POST_CATS = ['Travel guide', 'Planning', 'Culture', 'Practical', 'Gear', 'Horse treks', 'Day tours'];
const TOUR_FIELDS = [['name', 'Name'], ['category', 'Category'], ['duration', 'Duration'], ['summary', 'Description'], ['season', 'Best season'], ['start_from', 'Starts in'], ['tour_speed', 'Pace'], ['accommodations', 'Accommodation'], ['activities', 'Activities'], ['total_drive', 'Total drive'], ['highlights', 'Highlights'], ['tags', 'Tags']];
const POST_FIELDS = [['title', 'Title'], ['category', 'Category'], ['excerpt', 'Excerpt'], ['author', 'Author'], ['body', 'Body text']];

// ---------- auth ----------
bot.use(async (ctx, next) => {
  const id = ctx.from && ctx.from.id;
  if (OWNER_ID && id !== OWNER_ID) { if (ctx.reply) await ctx.reply('⛔ This is a private admin bot.'); return; }
  return next();
});

// Navigating away (a command, or tapping a section/menu button) abandons any
// half-finished edit or wizard, so the next thing you type isn't swallowed by a
// stale prompt. /done and /cancel manage the session themselves, so skip them.
bot.use(async (ctx, next) => {
  const cmd = ctx.message && typeof ctx.message.text === 'string' && ctx.message.text.startsWith('/') && !/^\/(done|cancel)\b/i.test(ctx.message.text);
  const nav = ctx.callbackQuery && /^(m:|t:list$|p:list$|g:list$|r:list$|sg:list$|l:list$|dr:list$|h:home$)/.test(ctx.callbackQuery.data || '');
  if ((cmd || nav) && ctx.from) sessions.delete(ctx.from.id);
  return next();
});

// ---------- helpers ----------
const daysFrom = d => { const m = String(d).match(/(\d+)/); return m ? Number(m[1]) : 0; };
// Messages use HTML (not Markdown): legacy Markdown has no reliable way to escape
// a stray * or ` in a value, so visitor text (leads/chats) or a tour name with a
// special char would make Telegram reject the whole message and the owner would
// stop seeing leads/chats. HTML only needs & < > escaped — same as server.js.
const md = { parse_mode: 'HTML' };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b = s => `<b>${esc(s)}</b>`;       // bold a (possibly untrusted) value safely
const code = s => `<code>${esc(s)}</code>`;
// A prompt that waits for the owner to send something always offers a way out,
// so there are no dead-ends where the only escape is remembering /cancel.
const cancelKb = () => new InlineKeyboard().text('✖️ Cancel', 'x:cancel');
const ask = (ctx, text) => ctx.reply(text, { ...md, reply_markup: cancelKb() });

async function downloadPhoto(ctx, fileId, kind, slug, n) {
  const file = await ctx.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const ext = path.extname(file.file_path) || '.jpg';
  C.ensureDirs();
  const dir = { post: 'posts', guide: 'guides', review: 'reviews', site: 'site', sights: 'sights' }[kind] || 'tours';
  const rel = `images/${dir}/${slug}-${n}-${Date.now().toString().slice(-5)}${ext}`;
  fs.writeFileSync(path.join(C.PUBLIC, rel), buf);
  return rel;
}
function delFile(rel) { try { fs.unlinkSync(path.join(C.PUBLIC, rel)); } catch (e) {} }

// Show the actual photos (numbered, ⭐ = cover) as an album so the owner isn't
// managing a gallery blind. Telegram albums hold up to 10; local files go as
// InputFile, external URLs (placeholders) as-is.
async function sendAlbum(ctx, images) {
  const imgs = (images || []).filter(Boolean).slice(0, 10);
  if (!imgs.length) return;
  const media = imgs.map((img, i) => ({
    type: 'photo',
    media: /^https?:\/\//.test(String(img)) ? String(img) : new InputFile(path.join(C.PUBLIC, img)),
    caption: i === 0 ? '1 ⭐ cover' : String(i + 1)
  }));
  try { await ctx.replyWithMediaGroup(media); } catch (e) { console.error('album send failed:', e.message); }
}

// ================= TOURS =================
function tourListKb() {
  const tours = C.loadTours();
  const kb = new InlineKeyboard();
  tours.slice(0, 40).forEach(t => kb.text(`${t.status === 'draft' ? '📝 ' : ''}${t.name}`.slice(0, 45), `t:v:${t.id}`).row());
  if (tours.length) kb.text('🔎 Search', 'xsearch:tour').row();
  kb.text('✍️ New tour with Claude', 'ai:tour').row();
  const more = tours.length > 40 ? ` (showing 40 — use 🔎 to find the rest)` : '';
  return { text: `📋 <b>${tours.length} tours</b>${more} — tap one:`, kb };
}
function tourView(id) {
  const t = C.loadTours().find(x => x.id === id);
  if (!t) return null;
  const kb = new InlineKeyboard()
    .text('✏️ Edit text', `t:e:${id}`).text('🖼 Photos', `t:ph:${id}`).row()
    .text('🗺 Itinerary', `t:itin:${id}`).row()
    .text('🗑 Delete', `t:del:${id}`).text('« Back', 't:list').row();
  const info = `${b(t.name)}\n📂 ${esc((t.cats || []).join(', ') || t.category)}\n⏱ ${esc(t.duration || '—')} · 📷 ${(t.images || []).length} photos\n\n${t.summary ? esc(t.summary.slice(0, 350)) : '<i>no description</i>'}`;
  return { info, kb };
}
function tourEditKb(id) {
  const kb = new InlineKeyboard();
  TOUR_FIELDS.forEach(([f, label], i) => { kb.text(label, `t:ef:${id}:${f}`); if (i % 2) kb.row(); });
  kb.row().text('« Back', `t:v:${id}`);
  return kb;
}
function tourPhotosView(id) {
  const t = C.loadTours().find(x => x.id === id);
  if (!t) return null;
  const imgs = t.images || [];
  const kb = new InlineKeyboard();
  imgs.forEach((img, i) => {
    kb.text(`${i === 0 ? '⭐' : '🖼'} ${i + 1}`, 't:noop')
      .text('⭐', `t:phmain:${id}:${i}`).text('🔼', `t:phup:${id}:${i}`).text('🔽', `t:phdn:${id}:${i}`).text('🗑', `t:phdel:${id}:${i}`).row();
  });
  if (imgs.length) kb.text('🔄 Show photos', `t:phshow:${id}`).row();
  kb.text('➕ Add photos', `t:phadd:${id}`).row().text('« Back', `t:v:${id}`);
  return { text: `🖼 ${b(t.name)} — ${imgs.length} photo(s)\n⭐ = cover (first) · 🔼🔽 reorder · 🗑 delete · ➕ add.`, kb };
}

// ---- itinerary (day-by-day plan) ----
const DAY_FIELDS = [['title', 'Title'], ['desc', 'Description'], ['transfer', 'Transfer'], ['activity', 'Activity'], ['meals', 'Meals'], ['overnight', 'Overnight']];
function itineraryView(id) {
  const t = C.loadTours().find(x => x.id === id);
  if (!t) return null;
  const days = t.itinerary || [];
  const kb = new InlineKeyboard();
  days.forEach((d, i) => kb.text(`Day ${d.day || i + 1} — ${(d.title || 'untitled').slice(0, 35)}`, `t:day:${id}:${i}`).row());
  kb.text('➕ Add day', `t:dayadd:${id}`).row().text('« Back', `t:v:${id}`);
  return { text: `🗺 ${b(t.name)} — ${days.length} day(s). Tap a day to edit, or add one.`, kb };
}
function dayView(id, idx) {
  const t = C.loadTours().find(x => x.id === id);
  if (!t || !t.itinerary || !t.itinerary[idx]) return null;
  const d = t.itinerary[idx];
  const descTxt = Array.isArray(d.desc) ? d.desc.join('\n\n') : (d.desc || '');
  const kb = new InlineKeyboard();
  DAY_FIELDS.forEach(([f, l], i) => { kb.text(l, `t:df:${id}:${idx}:${f}`); if (i % 2) kb.row(); });
  kb.row().text('🗑 Delete day', `t:daydel:${id}:${idx}`).text('« Days', `t:itin:${id}`);
  const lines = [
    `🗺 <b>Day ${d.day || idx + 1}</b> — ${esc(d.title || 'untitled')}`,
    descTxt ? `\n${esc(descTxt.slice(0, 500))}` : '\n<i>(no description)</i>',
    d.transfer ? `\n🚐 ${esc(d.transfer)}` : '',
    d.activity ? `🥾 ${esc(d.activity)}` : '',
    d.meals ? `🍽 ${esc(d.meals)}` : '',
    d.overnight ? `🌙 ${esc(d.overnight)}` : ''
  ].filter(Boolean);
  return { text: lines.join('\n'), kb };
}

// ================= POSTS =================
function postListKb() {
  const posts = C.loadPosts();
  const kb = new InlineKeyboard();
  posts.forEach(p => kb.text(`${p.status === 'draft' ? '📝 ' : ''}${p.title}`.slice(0, 45), `p:v:${p.id}`).row());
  if (posts.length) kb.text('🔎 Search', 'xsearch:post').row();
  kb.text('➕ New article', 'p:add').text('✍️ New post with Claude', 'ai:post').row();
  return { text: `📰 <b>${posts.length} articles</b> — tap one:`, kb };
}
function postView(id) {
  const p = C.loadPosts().find(x => x.id === id);
  if (!p) return null;
  const kb = new InlineKeyboard()
    .text('✏️ Edit', `p:e:${id}`).text('🖼 Cover', `p:cover:${id}`).row()
    .text('🏞 Gallery', `p:ph:${id}`).text('🗑 Delete', `p:del:${id}`).row()
    .text('« Back', 'p:list');
  const info = `${b(p.title)}\n📂 ${esc(p.category)} · ✍️ ${esc(p.author)}\n📅 ${esc(p.date)} · 🏞 ${(p.images || []).length} gallery photos\n\n<i>${esc((p.excerpt || '').slice(0, 200))}</i>`;
  return { info, kb };
}
function postEditKb(id) {
  const kb = new InlineKeyboard();
  POST_FIELDS.forEach(([f, label], i) => { kb.text(label, `p:ef:${id}:${f}`); if (i % 2) kb.row(); });
  kb.row().text('« Back', `p:v:${id}`);
  return kb;
}

// ---------- commands ----------
bot.command('whoami', ctx => ctx.reply(`Your Telegram ID: ${ctx.from.id}`));
bot.command('cancel', ctx => { sessions.delete(ctx.from.id); ctx.reply('Cancelled. ✅'); });
bot.callbackQuery('x:cancel', async ctx => { sessions.delete(ctx.from.id); await ctx.answerCallbackQuery({ text: 'Cancelled' }); await ctx.reply('Cancelled. ✅ Use /start for the menu.'); });
bot.callbackQuery(/^xsearch:(\w+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'search', kind: ctx.match[1] }); await ctx.answerCallbackQuery(); await ask(ctx, '🔎 Type part of the name to search for:'); });
const MENU_TEXT = '🏔️ <b>Azat Tours admin bot</b>\n\nTap a section below — or type a command (see the “/” menu). /help for details.';
function mainMenuKb() {
  const drafts = C.loadPosts().filter(p => p.status === 'draft').length + C.loadTours().filter(t => t.status === 'draft').length;
  const kb = new InlineKeyboard()
    .text('🏔 Tours', 't:list').text('📰 Blog', 'p:list').row()
    .text('🧭 Guides', 'g:list').text('⭐ Reviews', 'r:list').row()
    .text('🏠 Homepage photos', 'h:home').row();
  if (drafts) kb.text(`📝 Drafts (${drafts})`, 'dr:list').row();
  kb.text('📨 Leads', 'm:leads').text('💬 Chats', 'm:chats').row();
  return kb;
}
bot.command('start', async ctx => {
  if (!OWNER_ID) { setOwner(ctx.from.id); await ctx.reply(`✅ You are now the admin (ID ${ctx.from.id}).`); }
  await ctx.reply(MENU_TEXT, { ...md, reply_markup: mainMenuKb() });
});
bot.command('menu', ctx => ctx.reply(MENU_TEXT, { ...md, reply_markup: mainMenuKb() }));
bot.callbackQuery('m:home', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply(MENU_TEXT, { ...md, reply_markup: mainMenuKb() }); });
bot.callbackQuery('m:leads', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = leadListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('m:chats', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply(chatsText(), md); });
bot.command('help', ctx => ctx.reply(
  '📖 Azat Tours admin — everything you can do:\n\n' +
  '/start — main menu (buttons for all of the below)\n\n' +
  'CONTENT\n' +
  '/tours — tours: edit text, itinerary, photos, delete · /addtour\n' +
  '/posts — blog: edit, cover, gallery, delete · /addpost\n' +
  '/guides — guides · /addguide\n' +
  '/reviews — reviews · /addreview\n' +
  '/sights — places on tour pages: add, rename, photo, delete\n' +
  '/home — homepage photos (hero, Instagram, experience cards)\n\n' +
  'ENQUIRIES\n' +
  '/leads — website enquiries: reply on WhatsApp, mark handled\n' +
  '/chats — website chats: reply with "/reply <id> <text>"\n\n' +
  'TIPS\n' +
  '• Every list has a 🔎 Search button.\n' +
  '• Opening photos shows an album; 🔼🔽 reorder, ⭐ = cover.\n' +
  '• A ✖️ Cancel button is on every prompt (or type /cancel).\n' +
  '• Add photos by sending them, then /done.\n' +
  '• Article body: "## Heading", "- list", "> quote", "**bold**", "[img:URL|caption]", "[tip:Title|Text]".'
));

bot.command('tours', ctx => { const { text, kb } = tourListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.command('posts', ctx => { const { text, kb } = postListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });

// recent leads — a tappable list; each opens a card with WhatsApp reply + "handled"
function leadListKb() {
  const leads = store.listLeads(20);
  const kb = new InlineKeyboard();
  if (!leads.length) return { text: 'No leads yet. They will appear here the moment someone submits a form.', kb };
  leads.forEach(l => kb.text(`${l.handled ? '✅' : '🆕'} ${(l.name || '—') + (l.tour ? ' · ' + l.tour : '')}`.slice(0, 55), `l:v:${l.id}`).row());
  return { text: '📨 <b>Recent leads</b> — tap one to reply or mark it handled:', kb };
}
function leadView(id) {
  const l = store.getLead(id);
  if (!l) return null;
  const when = l.ts ? String(l.ts).slice(0, 16).replace('T', ' ') : '';
  const lines = [
    l.handled ? '✅ <b>Handled</b>' : '🆕 <b>New lead</b>',
    l.tour ? `🏔 ${esc(l.tour)}` : '',
    `👤 ${esc(l.name || '—')}`,
    `✉️ <code>${esc(l.email || '—')}</code>`,
    l.people ? `👥 ${esc(l.people)} traveller(s)` : '',
    l.dates ? `📅 ${esc(l.dates)}` : '',
    l.whatsapp ? `📱 <code>${esc(l.whatsapp)}</code>` : '',
    l.msg ? `💬 ${esc(l.msg)}` : '',
    l.trip_summary ? `\n${esc(l.trip_summary)}` : '',
    when ? `\n🕓 ${esc(when)}` : ''
  ].filter(Boolean);
  const kb = new InlineKeyboard();
  const wa = waLink(l);
  if (wa) kb.url('💬 Reply on WhatsApp', wa).row();
  if (!l.handled) kb.text('✅ Mark handled', `l:done:${l.id}`).row();
  kb.text('« Back', 'l:list');
  return { text: lines.join('\n'), kb };
}
bot.command('leads', ctx => { const { text, kb } = leadListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('l:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = leadListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery(/^l:v:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = leadView(Number(ctx.match[1])); if (!v) return ctx.reply('Lead not found.'); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^l:done:(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]);
  store.markLeadHandled(id);
  await ctx.answerCallbackQuery({ text: 'Marked handled ✅' });
  const v = leadView(id);
  if (v) { try { await ctx.editMessageText(v.text, { ...md, reply_markup: v.kb }); } catch (e) { await ctx.reply(v.text, { ...md, reply_markup: v.kb }); } }
});

// answer an on-site chat by id: /reply <sid> <text>
bot.command('reply', ctx => {
  const rest = ctx.message.text.replace(/^\/reply@?\w*/i, '').trim();
  const sp = rest.indexOf(' ');
  if (sp < 1) return ctx.reply('Usage: /reply &lt;chat-id&gt; &lt;your answer&gt;');
  const sid = rest.slice(0, sp), text = rest.slice(sp + 1).trim();
  if (!text) return ctx.reply('Add your answer after the id.');
  store.addMessage(sid, 'owner', text);
  ctx.reply('✅ Sent to the visitor on the website.');
});

// list open chats
function chatsText() {
  const chats = store.listOpenChats(10);
  if (!chats.length) return 'No chats yet.';
  return '💬 <b>Open chats</b> (reply with /reply &lt;id&gt; &lt;text&gt;)\n\n' + chats.map(c => {
    const last = c.messages.at(-1);
    return `• ${code(c.sid)}${c.name ? ' — ' + esc(c.name) : ''}\n  ${last ? esc((last.from === 'owner' ? 'you: ' : 'them: ') + last.text.slice(0, 60)) : ''}`;
  }).join('\n\n');
}
bot.command('chats', ctx => ctx.reply(chatsText(), md));

// ---------- drafts review queue (content waiting to go live) ----------
function draftListKb() {
  const posts = C.loadPosts().filter(p => p.status === 'draft');
  const tours = C.loadTours().filter(t => t.status === 'draft');
  const kb = new InlineKeyboard();
  posts.forEach(p => kb.text(`📰 ${(p.title || 'untitled').slice(0, 40)}`, `dr:v:p:${p.id}`).row());
  tours.forEach(t => kb.text(`🏔 ${(t.name || 'untitled').slice(0, 40)}`, `dr:v:t:${t.id}`).row());
  const n = posts.length + tours.length;
  const text = n
    ? `📝 <b>${n} draft(s)</b> waiting for your review. Tap one to read it and publish, edit or discard:`
    : 'No drafts. New posts and tours land here first, so nothing goes live until you publish it.';
  return { text, kb };
}
function draftView(kind, id) {
  if (kind === 'p') {
    const p = C.loadPosts().find(x => x.id === id); if (!p || p.status !== 'draft') return null;
    const body = p.body || '';
    const text = `📰 <b>DRAFT</b> — ${b(p.title)}\n📂 ${esc(p.category)} · ✍️ ${esc(p.author)}\n\n<i>${esc((p.excerpt || '').slice(0, 200))}</i>\n\n${esc(body.slice(0, 700))}${body.length > 700 ? '…' : ''}`;
    const kb = new InlineKeyboard();
    if (PREVIEW_KEY && p.slug) kb.url('👁 Preview on site', `${ORIGIN}/post.html?slug=${encodeURIComponent(p.slug)}&preview=${PREVIEW_KEY}`).row();
    kb.text('✅ Publish', `dr:pub:p:${id}`).text('✏️ Edit', `p:v:${id}`).row().text('🗑 Discard', `dr:disc:p:${id}`).text('« Drafts', 'dr:list').row();
    return { text, kb };
  }
  const t = C.loadTours().find(x => x.id === id); if (!t || t.status !== 'draft') return null;
  const text = `🏔 <b>DRAFT</b> — ${b(t.name)}\n📂 ${esc((t.cats || []).join(', ') || t.category)} · ⏱ ${esc(t.duration || '—')}\n🗺 ${(t.itinerary || []).length} day(s) · 📷 ${(t.images || []).length} photo(s)\n\n${esc((t.summary || '').slice(0, 600))}`;
  const kb = new InlineKeyboard();
  if (PREVIEW_KEY && t.slug) kb.url('👁 Preview on site', `${ORIGIN}/tour.html?slug=${encodeURIComponent(t.slug)}&preview=${PREVIEW_KEY}`).row();
  kb.text('✅ Publish', `dr:pub:t:${id}`).text('✏️ Edit', `t:v:${id}`).row().text('🗑 Discard', `dr:disc:t:${id}`).text('« Drafts', 'dr:list').row();
  return { text, kb };
}
bot.command('drafts', ctx => { const { text, kb } = draftListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('dr:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = draftListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery(/^dr:v:(p|t):(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = draftView(ctx.match[1], Number(ctx.match[2])); if (!v) return ctx.reply('Draft not found (maybe already published).'); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^dr:pub:(p|t):(\d+)$/, async ctx => {
  const kind = ctx.match[1], id = Number(ctx.match[2]); await ctx.answerCallbackQuery({ text: 'Published ✅' });
  if (kind === 'p') {
    const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
    if (p) { p.status = 'published'; if (!p.date) p.date = new Date().toISOString().slice(0, 10); C.savePosts(posts); }
    await ctx.reply(`🎉 Published ${b(p ? p.title : id)}. It's live on the blog now.`, md);
  } else {
    const tours = C.loadTours(); const t = tours.find(x => x.id === id);
    if (t) { t.status = 'published'; C.saveTours(tours); }
    await ctx.reply(`🎉 Published ${b(t ? t.name : id)}. It's live now.`, md);
  }
});
bot.callbackQuery(/^dr:disc:(p|t):(\d+)$/, async ctx => { const kind = ctx.match[1], id = Number(ctx.match[2]); await ctx.answerCallbackQuery(); await ctx.reply('Discard this draft for good? It was never published.', { reply_markup: new InlineKeyboard().text('🗑 Yes, discard', `dr:discyes:${kind}:${id}`).text('« Keep', `dr:v:${kind}:${id}`) }); });
bot.callbackQuery(/^dr:discyes:(p|t):(\d+)$/, async ctx => {
  const kind = ctx.match[1], id = Number(ctx.match[2]); await ctx.answerCallbackQuery({ text: 'Discarded' });
  if (kind === 'p') {
    const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
    if (p) { (p.images || []).forEach(im => { if (String(im).startsWith('images/')) delFile(im); }); if (p.cover && String(p.cover).startsWith('images/')) delFile(p.cover); C.savePosts(posts.filter(x => x.id !== id)); }
  } else {
    const tours = C.loadTours(); const t = tours.find(x => x.id === id);
    if (t) { (t.images || []).forEach(im => { if (String(im).startsWith('images/')) delFile(im); }); C.saveTours(tours.filter(x => x.id !== id)); }
  }
  const { text, kb } = draftListKb(); await ctx.reply('🗑 Draft discarded.\n\n' + text, { ...md, reply_markup: kb });
});

// ---------- order content from Claude (brief -> AI draft -> review queue) ----------
bot.callbackQuery('ai:post', async ctx => {
  await ctx.answerCallbackQuery();
  if (!ai.available()) return ctx.reply('✍️ Claude drafting is not set up yet — ' + ai.why() + '.');
  sessions.set(ctx.from.id, { mode: 'aibrief', kind: 'post', brief: '' });
  await ask(ctx, '✍️ <b>New post with Claude</b>\n\nDescribe the post: the topic and the facts (numbers, places, dates). I write it in our voice using only your facts, and mark anything missing so you can fill it in. Send it in one or several messages, then /done.');
});
bot.callbackQuery('ai:tour', async ctx => {
  await ctx.answerCallbackQuery();
  if (!ai.available()) return ctx.reply('✍️ Claude drafting is not set up yet — ' + ai.why() + '.');
  sessions.set(ctx.from.id, { mode: 'aibrief', kind: 'tour', brief: '' });
  await ask(ctx, '✍️ <b>New tour with Claude</b>\n\nRoughly describe the program: the route day by day and the facts (distances, altitudes, seasons). I draft the tour from your facts and invent nothing. Send it, then /done.');
});
async function sendLong(ctx, text) {
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 3800) await ctx.reply(esc(s.slice(i, i + 3800)), md);
}
async function aiDraft(ctx, s) {
  if (!s.brief || !s.brief.trim()) { sessions.delete(ctx.from.id); return ctx.reply('No brief received. Tap the button again and send some text first.'); }
  await ctx.reply('✍️ Writing your draft, one moment…');
  try {
    if (s.kind === 'post') {
      const out = await ai.draftPost(s.brief);
      const posts = C.loadPosts(); const d = C.blankPost();
      Object.assign(d, { title: out.title, excerpt: out.excerpt, category: out.category, body: out.body });
      d.id = C.nextPostId(posts); d.slug = C.uniquePostSlug(d.title, posts); d.date = new Date().toISOString().slice(0, 10);
      if (!d.cover) d.cover = 'img/hero/hero-1-reflection-1400.jpg';
      d.status = 'draft'; posts.unshift(d); C.savePosts(posts); sessions.delete(ctx.from.id);
      await ctx.reply('✅ <b>Draft ready.</b> Full text below. Add photos and publish from 📝 Drafts.', md);
      await sendLong(ctx, out.body);
      const v = draftView('p', d.id); return ctx.reply(v.text, { ...md, reply_markup: v.kb });
    }
    const out = await ai.draftTour(s.brief);
    const tours = C.loadTours(); const d = C.blankTour();
    Object.assign(d, { name: out.name, category: out.category, cats: [out.category], duration: out.duration, days: daysFrom(out.duration), season: out.season, summary: out.summary, highlights: out.highlights, itinerary: out.itinerary });
    d.id = C.nextId(tours); d.slug = C.uniqueSlug(d.name, tours); d.status = 'draft'; tours.unshift(d); C.saveTours(tours); sessions.delete(ctx.from.id);
    await ctx.reply('✅ <b>Draft ready.</b> Open Edit → Itinerary to review each day, add photos, then publish from 📝 Drafts.', md);
    const v = draftView('t', d.id); return ctx.reply(v.text, { ...md, reply_markup: v.kb });
  } catch (e) {
    console.error('ai draft failed:', e); sessions.delete(ctx.from.id);
    return ctx.reply('⚠️ Could not write the draft — ' + (e.message || 'unknown error') + '. Try again.');
  }
}

bot.command('addtour', ctx => {
  sessions.set(ctx.from.id, { mode: 'addtour', step: 'name', draft: C.blankTour() });
  ctx.reply('🆕 <b>New tour</b>\n\nTour <b>name</b>?', md);
});
bot.command('addpost', ctx => {
  sessions.set(ctx.from.id, { mode: 'addpost', step: 'title', draft: C.blankPost() });
  ctx.reply('🆕 <b>New article</b>\n\nArticle <b>title</b>?', md);
});

bot.command('done', async ctx => {
  const s = sessions.get(ctx.from.id);
  if (!s) return;
  if (s.mode === 'addtour' && s.step === 'photos') return saveTourDraft(ctx, s);
  if (s.mode === 'addpost' && s.step === 'extra') return savePostDraft(ctx, s);
  if (s.mode === 'addguide' && s.step === 'photo') return saveGuideDraft(ctx, s);
  if (s.mode === 'addreview' && s.step === 'photo') return saveReviewDraft(ctx, s);
  if (s.mode === 'aibrief') return aiDraft(ctx, s);
  if (s.mode === 'addphotos') { sessions.delete(ctx.from.id); return ctx.reply('✅ Done adding photos.'); }
});

// ---------- tour callbacks ----------
bot.callbackQuery('t:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = tourListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('t:noop', ctx => ctx.answerCallbackQuery());
bot.callbackQuery(/^t:v:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = tourView(Number(ctx.match[1])); if (!v) return ctx.reply('Not found.'); await ctx.reply(v.info, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^t:e:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('Which field to edit?', { reply_markup: tourEditKb(Number(ctx.match[1])) }); });
bot.callbackQuery(/^t:ef:(\d+):(\w+)$/, async ctx => {
  const id = Number(ctx.match[1]), field = ctx.match[2];
  await ctx.answerCallbackQuery();
  if (field === 'category') {
    const kb = new InlineKeyboard(); TOUR_CATS.forEach(c => kb.text(c, `t:setcat:${id}:${c}`).row());
    return ctx.reply('Pick a category:', { reply_markup: kb });
  }
  const t = C.loadTours().find(x => x.id === id);
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'tour', id, field });
  const hint = field === 'highlights' ? ' (comma-separated)' : '';
  await ask(ctx, `✏️ ${b(t ? t.name : 'tour')} → send the new ${b((TOUR_FIELDS.find(f => f[0] === field) || [, field])[1])}${hint}:`);
});
bot.callbackQuery(/^t:setcat:(\d+):(.+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (t) { t.category = ctx.match[2]; t.cats = [ctx.match[2]]; C.saveTours(tours); }
  await ctx.reply(`✅ Category set to ${b(ctx.match[2])}. Site updated.`, md);
});
bot.callbackQuery(/^t:ph:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const id = Number(ctx.match[1]); const t = C.loadTours().find(x => x.id === id); if (t) await sendAlbum(ctx, t.images); const v = tourPhotosView(id); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^t:phshow:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const t = C.loadTours().find(x => x.id === Number(ctx.match[1])); if (t) await sendAlbum(ctx, t.images); });
bot.callbackQuery(/^t:phup:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (t && t.images && i > 0 && t.images[i]) { [t.images[i - 1], t.images[i]] = [t.images[i], t.images[i - 1]]; C.saveTours(tours); }
  const v = tourPhotosView(id); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^t:phdn:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (t && t.images && i < t.images.length - 1) { [t.images[i + 1], t.images[i]] = [t.images[i], t.images[i + 1]]; C.saveTours(tours); }
  const v = tourPhotosView(id); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^t:phadd:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'addphotos', kind: 'tour', id }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send photos now, then tap /done.'); });
bot.callbackQuery(/^t:phdel:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  await ctx.reply(`Delete photo ${idx + 1}? This can't be undone.`, { reply_markup: new InlineKeyboard().text('🗑 Yes, delete', `t:phdelyes:${id}:${idx}`).text('« Keep', `t:ph:${id}`) });
});
bot.callbackQuery(/^t:phdelyes:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery({ text: 'Deleted' });
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (t && t.images[idx]) { if (t.images[idx].startsWith('images/')) delFile(t.images[idx]); t.images.splice(idx, 1); C.saveTours(tours); }
  const v = tourPhotosView(id); if (v) await ctx.reply('🗑 Removed.\n\n' + v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^t:phmain:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (t && t.images[idx]) { const [img] = t.images.splice(idx, 1); t.images.unshift(img); C.saveTours(tours); }
  const v = tourPhotosView(id); if (v) await ctx.reply('⭐ Main photo set.\n\n' + v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^t:del:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Delete this tour for good?', { reply_markup: new InlineKeyboard().text('✅ Yes', `t:delyes:${id}`).text('Cancel', `t:v:${id}`) }); });
bot.callbackQuery(/^t:delyes:(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery({ text: 'Deleted' });
  let tours = C.loadTours(); const t = tours.find(x => x.id === id);
  C.saveTours(tours.filter(x => x.id !== id));
  let moved = 0;
  if (t) { const rs = C.loadReviews(); rs.forEach(r => { if (r.placement === 'tour:' + t.slug) { r.placement = 'reviews'; moved++; } }); if (moved) C.saveReviews(rs); }
  await ctx.reply(`🗑 Deleted ${b(t ? t.name : id)}. Site updated.${moved ? `\n${moved} review(s) moved to the Reviews page.` : ''}`, md);
});

// ---- itinerary handlers ----
bot.callbackQuery(/^t:itin:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = itineraryView(Number(ctx.match[1])); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^t:day:(\d+):(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = dayView(Number(ctx.match[1]), Number(ctx.match[2])); if (!v) return ctx.reply('Day not found.'); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^t:df:(\d+):(\d+):(\w+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]), field = ctx.match[3]; await ctx.answerCallbackQuery();
  const t = C.loadTours().find(x => x.id === id); const d = t && t.itinerary && t.itinerary[idx];
  if (!d) return ctx.reply('Day not found.');
  sessions.set(ctx.from.id, { mode: 'dayfield', id, idx, field });
  const cur = field === 'desc' ? (Array.isArray(d.desc) ? d.desc.join('\n\n') : (d.desc || '')) : (d[field] || '');
  const label = (DAY_FIELDS.find(f => f[0] === field) || [, field])[1];
  const hint = field === 'desc' ? '\n\n<i>Separate paragraphs with a blank line.</i>' : '';
  await ask(ctx, `✏️ Day ${d.day || idx + 1} → send the new ${b(label)}:${hint}${cur ? '\n\nCurrent:\n' + esc(cur.slice(0, 400)) : ''}`);
});
bot.callbackQuery(/^t:dayadd:(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (!t) return ctx.reply('Tour not found.');
  t.itinerary = t.itinerary || [];
  t.itinerary.push({ day: t.itinerary.length + 1, title: 'New day', desc: [], transfer: '', activity: '', meals: '', overnight: '', wc: '', internet: '' });
  C.saveTours(tours);
  const idx = t.itinerary.length - 1; const v = dayView(id, idx); if (v) await ctx.reply('➕ Day added. Now fill it in:\n\n' + v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^t:daydel:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  await ctx.reply(`Delete day ${idx + 1}? This can't be undone.`, { reply_markup: new InlineKeyboard().text('🗑 Yes, delete', `t:daydelyes:${id}:${idx}`).text('« Keep', `t:day:${id}:${idx}`) });
});
bot.callbackQuery(/^t:daydelyes:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery({ text: 'Deleted' });
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (t && t.itinerary && t.itinerary[idx]) { t.itinerary.splice(idx, 1); t.itinerary.forEach((d, i) => d.day = i + 1); C.saveTours(tours); }
  const v = itineraryView(id); if (v) await ctx.reply('🗑 Day removed.\n\n' + v.text, { ...md, reply_markup: v.kb });
});

// ---------- post callbacks ----------
bot.callbackQuery('p:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = postListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('p:add', async ctx => { await ctx.answerCallbackQuery(); sessions.set(ctx.from.id, { mode: 'addpost', step: 'title', draft: C.blankPost() }); await ctx.reply('🆕 <b>New article</b>\n\nArticle <b>title</b>?', md); });
bot.callbackQuery(/^p:v:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = postView(Number(ctx.match[1])); if (!v) return ctx.reply('Not found.'); await ctx.reply(v.info, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^p:e:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('Which field to edit?', { reply_markup: postEditKb(Number(ctx.match[1])) }); });
bot.callbackQuery(/^p:ef:(\d+):(\w+)$/, async ctx => {
  const id = Number(ctx.match[1]), field = ctx.match[2]; await ctx.answerCallbackQuery();
  if (field === 'category') { const kb = new InlineKeyboard(); POST_CATS.forEach((c, i) => { kb.text(c, `p:setcat:${id}:${c}`); if (i % 2) kb.row(); }); return ctx.reply('Pick a category:', { reply_markup: kb }); }
  const po = C.loadPosts().find(x => x.id === id);
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'post', id, field });
  const hint = field === 'body' ? '\n\n<i>You can use ## headings, - lists, &gt; quotes, **bold**, [img:URL|caption], [tip:Title|Text].</i>' : '';
  await ask(ctx, `✏️ ${b(po ? po.title : 'article')} → send the new ${b((POST_FIELDS.find(f => f[0] === field) || [, field])[1])}:${hint}`);
});
bot.callbackQuery(/^p:setcat:(\d+):(.+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  if (p) { p.category = ctx.match[2]; C.savePosts(posts); }
  await ctx.reply(`✅ Category set to ${b(ctx.match[2])}.`, md);
});
bot.callbackQuery(/^p:cover:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'setcover', id }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send the new cover photo.'); });
function postGalleryView(id) {
  const p = C.loadPosts().find(x => x.id === id);
  if (!p) return null;
  const imgs = p.images || [];
  const kb = new InlineKeyboard();
  imgs.forEach((img, i) => {
    kb.text(`${i === 0 ? '⭐' : '🏞'} ${i + 1}`, 'p:noop')
      .text('⭐', `p:phmain:${id}:${i}`).text('🔼', `p:phup:${id}:${i}`).text('🔽', `p:phdn:${id}:${i}`).text('🗑', `p:phdel:${id}:${i}`).row();
  });
  if (imgs.length) kb.text('🔄 Show photos', `p:phshow:${id}`).row();
  kb.text('➕ Add photos', `p:phadd:${id}`).row().text('« Back', `p:v:${id}`);
  return { text: `🏞 ${b(p.title)} — ${imgs.length} gallery photo(s)\n⭐ = first · 🔼🔽 reorder · 🗑 delete · ➕ add.`, kb };
}
bot.callbackQuery(/^p:ph:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const id = Number(ctx.match[1]); const p = C.loadPosts().find(x => x.id === id); if (p) await sendAlbum(ctx, p.images); const v = postGalleryView(id); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^p:phshow:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const p = C.loadPosts().find(x => x.id === Number(ctx.match[1])); if (p) await sendAlbum(ctx, p.images); });
bot.callbackQuery(/^p:phmain:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  if (p && p.images && p.images[i]) { const [img] = p.images.splice(i, 1); p.images.unshift(img); C.savePosts(posts); }
  const v = postGalleryView(id); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^p:phup:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  if (p && p.images && i > 0 && p.images[i]) { [p.images[i - 1], p.images[i]] = [p.images[i], p.images[i - 1]]; C.savePosts(posts); }
  const v = postGalleryView(id); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^p:phdn:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  if (p && p.images && i < p.images.length - 1) { [p.images[i + 1], p.images[i]] = [p.images[i], p.images[i + 1]]; C.savePosts(posts); }
  const v = postGalleryView(id); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery('p:noop', ctx => ctx.answerCallbackQuery());
bot.callbackQuery(/^p:phadd:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'addphotos', kind: 'post', id }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send gallery photos, then tap /done.'); });
bot.callbackQuery(/^p:phdel:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  await ctx.reply(`Delete gallery photo ${idx + 1}? This can't be undone.`, { reply_markup: new InlineKeyboard().text('🗑 Yes, delete', `p:phdelyes:${id}:${idx}`).text('« Keep', `p:ph:${id}`) });
});
bot.callbackQuery(/^p:phdelyes:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery({ text: 'Deleted' });
  const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  if (p && p.images[idx]) { if (p.images[idx].startsWith('images/')) delFile(p.images[idx]); p.images.splice(idx, 1); C.savePosts(posts); }
  const v = postGalleryView(id); if (v) await ctx.reply('🗑 Removed.\n\n' + v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^p:del:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Delete this article for good?', { reply_markup: new InlineKeyboard().text('✅ Yes', `p:delyes:${id}`).text('Cancel', `p:v:${id}`) }); });
bot.callbackQuery(/^p:delyes:(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery({ text: 'Deleted' });
  let posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  C.savePosts(posts.filter(x => x.id !== id));
  await ctx.reply(`🗑 Deleted ${b(p ? p.title : id)}. Site updated.`, md);
});

// addtour category (wizard)
bot.callbackQuery(/^cat:(.+)$/, async ctx => {
  const s = sessions.get(ctx.from.id); await ctx.answerCallbackQuery();
  if (!s || s.mode !== 'addtour' || s.step !== 'category') return;
  s.draft.cats = [ctx.match[1]]; s.draft.category = ctx.match[1]; s.step = 'duration';
  await ctx.reply('How long is it? e.g. <b>7 days</b>', md);
});
// addpost category (wizard)
bot.callbackQuery(/^pcatnew:(.+)$/, async ctx => {
  const s = sessions.get(ctx.from.id); await ctx.answerCallbackQuery();
  if (!s || s.mode !== 'addpost' || s.step !== 'category') return;
  s.draft.category = ctx.match[1]; s.step = 'excerpt';
  await ctx.reply('Short <b>excerpt</b> (1 sentence shown on the blog list):', md);
});

// ---------- text routing ----------
bot.on('message:text', async ctx => {
  // owner answering an on-site chat by replying to its notification
  const rt = ctx.message.reply_to_message;
  if (rt && rt.text) {
    const m = rt.text.match(/#chat\s+(\S+)/);
    if (m) { store.addMessage(m[1], 'owner', ctx.message.text); return ctx.reply('✅ Sent to the visitor on the website.'); }
  }

  const s = sessions.get(ctx.from.id);
  if (!s) return;
  const txt = ctx.message.text;
  if (txt.startsWith('/')) return;

  // collecting a brief for an AI draft (accumulate messages until /done)
  if (s.mode === 'aibrief') {
    s.brief = (s.brief ? s.brief + '\n' : '') + txt;
    return ctx.reply('Got it. Add more detail, or /done to write the draft.', { ...md, reply_markup: cancelKb() });
  }

  // search within a list by name
  if (s.mode === 'search') {
    sessions.delete(ctx.from.id);
    const q = txt.trim().toLowerCase();
    if (!q) return ctx.reply('Empty search.');
    const cfg = {
      tour: { items: C.loadTours(), match: t => t.name, label: t => t.name, prefix: 't:v' },
      post: { items: C.loadPosts(), match: p => p.title, label: p => p.title, prefix: 'p:v' },
      guide: { items: C.loadGuides(), match: g => `${g.name} ${g.role}`, label: g => `${g.name} — ${g.role}`, prefix: 'g:v' },
      review: { items: C.loadReviews(), match: r => `${r.name} ${r.country || ''} ${r.text || ''}`, label: r => `${r.name} · ${placeLabel(r.placement)}`, prefix: 'r:v' }
    }[s.kind];
    if (!cfg) return;
    const hits = cfg.items.filter(x => String(cfg.match(x)).toLowerCase().includes(q)).slice(0, 40);
    if (!hits.length) return ctx.reply(`No matches for “${esc(txt.trim())}”.`);
    const kb = new InlineKeyboard();
    hits.forEach(x => kb.text(String(cfg.label(x)).slice(0, 45), `${cfg.prefix}:${x.id}`).row());
    return ctx.reply(`🔎 ${hits.length} match(es):`, { ...md, reply_markup: kb });
  }

  // edit a single field on an existing item
  if (s.mode === 'editfield') {
    // Validate before saving so an empty send can't wipe a title, and a bad
    // link can't reach the homepage. Session stays set so the owner can resend.
    const val = txt.trim();
    const REQUIRED = ['name', 'title', 'summary', 'text', 'excerpt', 'role', 'country', 'bio', 'duration', 'body'];
    if (s.field === 'instagram.url') {
      if (!/^https?:\/\/\S+$/i.test(val)) return ask(ctx, '⚠️ That doesn\'t look like a link. Send a full URL starting with https:// :');
    } else if (REQUIRED.includes(s.field)) {
      if (!val) return ask(ctx, '⚠️ That can\'t be empty. Send a value:');
      if (val.length > 4000) return ask(ctx, '⚠️ That\'s too long (max 4000 characters). Send a shorter version:');
    }
    try {
    if (s.kind === 'tour') {
      const tours = C.loadTours(); const t = tours.find(x => x.id === s.id); if (!t) { sessions.delete(ctx.from.id); return; }
      if (s.field === 'highlights') t.highlights = txt.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
      else if (s.field === 'tags') t.tags = txt.split(/[,\n]/).map(x => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
      else { t[s.field] = txt.trim(); if (s.field === 'duration') t.days = daysFrom(txt); }
      C.saveTours(tours);
    } else if (s.kind === 'post') {
      const posts = C.loadPosts(); const p = posts.find(x => x.id === s.id); if (!p) { sessions.delete(ctx.from.id); return; }
      p[s.field] = s.field === 'body' ? txt : txt.trim();
      C.savePosts(posts);
    } else if (s.kind === 'guide') {
      const gs = C.loadGuides(); const g = gs.find(x => x.id === s.id); if (!g) { sessions.delete(ctx.from.id); return; }
      if (s.field === 'languages') g.languages = txt.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      else g[s.field] = txt.trim();
      C.saveGuides(gs);
    } else if (s.kind === 'review') {
      const rs = C.loadReviews(); const r = rs.find(x => x.id === s.id); if (!r) { sessions.delete(ctx.from.id); return; }
      if (s.field === 'rating') r.rating = Math.max(1, Math.min(5, Number(txt.trim()) || 5));
      else r[s.field] = txt.trim();
      C.saveReviews(rs);
    } else if (s.kind === 'site') {
      const site = C.loadSite();
      const parts = s.field.split('.');
      let o = site; for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = txt.trim();
      C.saveSite(site);
    }
    } catch (e) {
      console.error('editfield save failed:', e);
      sessions.delete(ctx.from.id);
      return ctx.reply('⚠️ Could not save that — nothing was changed. Please try again.');
    }
    sessions.delete(ctx.from.id);
    return ctx.reply('✅ Saved. Site updated.');
  }

  // edit one field of one itinerary day
  if (s.mode === 'dayfield') {
    const val = txt.trim();
    if (!val && s.field === 'title') return ask(ctx, '⚠️ The day title can\'t be empty. Send a value:');
    try {
      const tours = C.loadTours(); const t = tours.find(x => x.id === s.id);
      const d = t && t.itinerary && t.itinerary[s.idx];
      if (!d) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ That day no longer exists.'); }
      if (s.field === 'desc') d.desc = txt.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
      else d[s.field] = val;
      C.saveTours(tours);
    } catch (e) {
      console.error('dayfield save failed:', e); sessions.delete(ctx.from.id);
      return ctx.reply('⚠️ Could not save that — nothing was changed. Please try again.');
    }
    sessions.delete(ctx.from.id);
    const v = dayView(s.id, s.idx);
    return ctx.reply('✅ Saved. Site updated.\n\n' + (v ? v.text : ''), v ? { ...md, reply_markup: v.kb } : md);
  }

  // edit a sight's description
  if (s.mode === 'sightblurb') {
    const sights = C.loadSights(); const st = sights[s.key];
    if (!st) { sessions.delete(ctx.from.id); return; }
    st.blurb = txt.trim(); C.saveSights(sights);
    sessions.delete(ctx.from.id);
    const v = sightView(s.key);
    return ctx.reply('✅ Description saved. Site updated.\n\n' + v.text, { ...md, reply_markup: v.kb });
  }
  if (s.mode === 'sightadd') {
    const name = txt.trim();
    if (!name) return ask(ctx, '⚠️ The name can\'t be empty. Send a name:');
    const sights = C.loadSights();
    let key = C.slugify(name), base = key, n = 2;
    while (sights[key]) key = base + '-' + n++;
    sights[key] = { name, photo: '', blurb: '' };
    C.saveSights(sights);
    sessions.delete(ctx.from.id);
    const v = sightView(key);
    return ctx.reply('✅ Place added. Add a photo or description:\n\n' + (v ? v.text : ''), v ? { ...md, reply_markup: v.kb } : md);
  }
  if (s.mode === 'sightname') {
    const name = txt.trim();
    if (!name) return ask(ctx, '⚠️ The name can\'t be empty. Send a name:');
    const sights = C.loadSights(); const st = sights[s.key];
    if (!st) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ That place no longer exists.'); }
    st.name = name; C.saveSights(sights);
    sessions.delete(ctx.from.id);
    const v = sightView(s.key);
    return ctx.reply('✅ Renamed. Site updated.\n\n' + v.text, { ...md, reply_markup: v.kb });
  }

  // addtour wizard
  if (s.mode === 'addtour') {
    if (s.step === 'name') { s.draft.name = txt.trim(); s.step = 'category'; const kb = new InlineKeyboard(); TOUR_CATS.forEach(c => kb.text(c, `cat:${c}`).row()); return ctx.reply('Pick a <b>category</b>:', { ...md, reply_markup: kb }); }
    if (s.step === 'duration') { s.draft.duration = txt.trim(); s.draft.days = daysFrom(txt); s.step = 'summary'; return ctx.reply('Short <b>description</b> (1–3 sentences):', md); }
    if (s.step === 'summary') { s.draft.summary = txt.trim(); s.step = 'photos'; return ctx.reply('📷 Send <b>photos</b> one by one (first = main), then /done. Or /done to skip.', md); }
  }

  // addpost wizard
  if (s.mode === 'addpost') {
    if (s.step === 'title') { s.draft.title = txt.trim(); s.step = 'category'; const kb = new InlineKeyboard(); POST_CATS.forEach((c, i) => { kb.text(c, `pcatnew:${c}`); if (i % 2) kb.row(); }); return ctx.reply('Pick a <b>category</b>:', { ...md, reply_markup: kb }); }
    if (s.step === 'excerpt') { s.draft.excerpt = txt.trim(); s.step = 'cover'; return ctx.reply('📷 Send a <b>cover photo</b> (or type <code>skip</code>):', md); }
    if (s.step === 'cover' && txt.trim().toLowerCase() === 'skip') { s.draft.cover = 'img/hero/hero-1-reflection-1400.jpg'; s.step = 'body'; return ctx.reply('✍️ Now send the <b>article body</b>.\n\n<i>Use ## headings, - lists, &gt; quotes, **bold**, [img:URL|caption], [tip:Title|Text]. First paragraph becomes the intro.</i>', md); }
    if (s.step === 'body') { s.draft.body = txt; s.step = 'extra'; return ctx.reply('🏞 Optional: send extra <b>gallery photos</b>, then /done. Or /done to finish now.', md); }
  }

  // addguide wizard
  if (s.mode === 'addguide') {
    if (s.step === 'name') { s.draft.name = txt.trim(); s.step = 'role'; return ctx.reply('Their <b>role</b>? e.g. Mountain guide', md); }
    if (s.step === 'role') { s.draft.role = txt.trim(); s.step = 'languages'; return ctx.reply('<b>Languages</b> (comma or space separated), e.g. <code>KG RU EN</code>:', md); }
    if (s.step === 'languages') { s.draft.languages = txt.split(/[,\s]+/).map(x => x.trim()).filter(Boolean); s.step = 'bio'; return ctx.reply('Short <b>bio</b> (1–2 sentences):', md); }
    if (s.step === 'bio') { s.draft.bio = txt.trim(); s.step = 'photo'; return ctx.reply('📷 Send a <b>photo</b> of the guide, or /done to skip.', md); }
  }

  // addreview wizard
  if (s.mode === 'addreview') {
    if (s.step === 'name') { s.draft.name = txt.trim(); s.step = 'country'; return ctx.reply('Their <b>country</b>? e.g. Germany', md); }
    if (s.step === 'country') { s.draft.country = txt.trim(); s.step = 'text'; return ctx.reply('Paste the <b>review text</b>:', md); }
    if (s.step === 'text') { s.draft.text = txt.trim(); s.step = 'rating'; const kb = new InlineKeyboard(); [5, 4, 3, 2, 1].forEach(n => kb.text('★'.repeat(n) + '☆'.repeat(5 - n), `rrate:${n}`).row()); return ctx.reply('Rating?', { reply_markup: kb }); }
  }
});

// ---------- photo routing ----------
bot.on('message:photo', async ctx => {
  const s = sessions.get(ctx.from.id);
  if (!s) return;
  const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  try {
    // NOTE: download the photo BEFORE loading the JSON, then load → mutate → save
    // with NO await in between. That keeps read-modify-write synchronous, so two
    // photos sent back-to-back can't interleave and lose each other's edit.
    const n = Date.now().toString().slice(-5);

    // adding to existing item
    if (s.mode === 'addphotos') {
      if (s.kind === 'tour') {
        const slug = (C.loadTours().find(x => x.id === s.id) || {}).slug || 'tour';
        const rel = await downloadPhoto(ctx, fileId, 'tour', slug, n);
        const tours = C.loadTours(); const t = tours.find(x => x.id === s.id);
        if (!t) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ That tour no longer exists.'); }
        t.images = t.images || []; t.images.push(rel); C.saveTours(tours);
        return ctx.reply(`✅ Photo added (${t.images.length}). Another, or /done.`);
      }
      const slug = (C.loadPosts().find(x => x.id === s.id) || {}).slug || 'post';
      const rel = await downloadPhoto(ctx, fileId, 'post', slug, n);
      const posts = C.loadPosts(); const p = posts.find(x => x.id === s.id);
      if (!p) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ That article no longer exists.'); }
      p.images = p.images || []; p.images.push(rel); C.savePosts(posts);
      return ctx.reply(`✅ Gallery photo added (${p.images.length}). Another, or /done.`);
    }
    // homepage photo (Instagram grid / hero / experience / builder)
    if (s.mode === 'sitephoto') {
      if (s.target === 'instagram') {
        const rel = await downloadPhoto(ctx, fileId, 'site', 'ig', n);
        const site = C.loadSite();
        site.instagram = site.instagram || { url: '', photos: [] };
        site.instagram.photos = site.instagram.photos || [];
        site.instagram.photos.push(rel); C.saveSite(site);
        return ctx.reply(`✅ Photo added (${site.instagram.photos.length}). Send another, or /home.`);
      }
      if (s.target === 'experience') {
        const rel = await downloadPhoto(ctx, fileId, 'site', 'exp', (s.idx + 1));
        const site = C.loadSite(); site.experiences = site.experiences || [];
        site.experiences[s.idx] = rel; C.saveSite(site);
        sessions.delete(ctx.from.id);
        return ctx.reply('✅ Card photo updated. Site updated. /home for more.');
      }
      if (s.target === 'hero') {
        const rel = await downloadPhoto(ctx, fileId, 'site', 'hero', n);
        const site = C.loadSite(); site.hero = rel; C.saveSite(site);
        sessions.delete(ctx.from.id);
        return ctx.reply('✅ Hero photo updated. Site updated.');
      }
      if (s.target === 'builder') {
        const rel = await downloadPhoto(ctx, fileId, 'site', 'builder', (s.idx + 1));
        const site = C.loadSite(); site.builder = site.builder || [];
        site.builder[s.idx] = rel; C.saveSite(site);
        sessions.delete(ctx.from.id);
        return ctx.reply('✅ Builder photo updated. Site updated. /home for more.');
      }
      sessions.delete(ctx.from.id);
      return ctx.reply('⚠️ Unknown photo target.');
    }
    // set new cover for a post
    if (s.mode === 'setcover') {
      const slug = (C.loadPosts().find(x => x.id === s.id) || {}).slug || 'post';
      const rel = await downloadPhoto(ctx, fileId, 'post', slug, 'cover');
      const posts = C.loadPosts(); const p = posts.find(x => x.id === s.id);
      if (!p) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ That article no longer exists.'); }
      p.cover = rel; C.savePosts(posts); sessions.delete(ctx.from.id);
      return ctx.reply('✅ Cover updated. Site updated.');
    }
    // addtour wizard photos (draft is in-memory; saved only on /done, so no file race)
    if (s.mode === 'addtour' && s.step === 'photos') { if (!s.draft.slug) s.draft.slug = C.uniqueSlug(s.draft.name, C.loadTours()); const rel = await downloadPhoto(ctx, fileId, 'tour', s.draft.slug, s.draft.images.length + 1); s.draft.images.push(rel); return ctx.reply(`✅ Photo ${s.draft.images.length} saved. Another, or /done.`); }
    // addpost cover
    if (s.mode === 'addpost' && s.step === 'cover') { if (!s.draft.slug) s.draft.slug = C.uniquePostSlug(s.draft.title, C.loadPosts()); const rel = await downloadPhoto(ctx, fileId, 'post', s.draft.slug, 'cover'); s.draft.cover = rel; s.step = 'body'; return ctx.reply('✅ Cover saved.\n\n✍️ Now send the <b>article body</b>.\n\n<i>Use ## headings, - lists, &gt; quotes, **bold**, [img:URL|caption], [tip:Title|Text].</i>', md); }
    // addpost extra gallery
    if (s.mode === 'addpost' && s.step === 'extra') { const rel = await downloadPhoto(ctx, fileId, 'post', s.draft.slug, s.draft.images.length + 1); s.draft.images.push(rel); return ctx.reply(`✅ Gallery photo ${s.draft.images.length} added. Another, or /done.`); }
    // guide photo (existing)
    if (s.mode === 'guidephoto') {
      const name = (C.loadGuides().find(x => x.id === s.id) || {}).name || 'guide';
      const rel = await downloadPhoto(ctx, fileId, 'guide', C.slugify(name), 'p');
      const gs = C.loadGuides(); const g = gs.find(x => x.id === s.id);
      if (!g) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ That guide no longer exists.'); }
      g.photo = rel; C.saveGuides(gs); sessions.delete(ctx.from.id);
      return ctx.reply('✅ Guide photo updated. Site updated.');
    }
    // addguide photo -> save (saveGuideDraft loads after this await, so no race)
    if (s.mode === 'addguide' && s.step === 'photo') { const rel = await downloadPhoto(ctx, fileId, 'guide', C.slugify(s.draft.name || 'guide'), 'p'); s.draft.photo = rel; return saveGuideDraft(ctx, s); }
    // review avatar (existing)
    if (s.mode === 'reviewavatar') {
      const rel = await downloadPhoto(ctx, fileId, 'review', 'rev', s.id);
      const rs = C.loadReviews(); const r = rs.find(x => x.id === s.id);
      if (!r) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ That review no longer exists.'); }
      r.avatar = rel; C.saveReviews(rs); sessions.delete(ctx.from.id);
      return ctx.reply('✅ Review photo updated.');
    }
    // addreview avatar -> save (saveReviewDraft loads after this await, so no race)
    if (s.mode === 'addreview' && s.step === 'photo') { const rel = await downloadPhoto(ctx, fileId, 'review', 'rev', n); s.draft.avatar = rel; return saveReviewDraft(ctx, s); }
    // sight photo (replace the photo for a place in "Sights visited on this tour")
    if (s.mode === 'sightphoto') {
      const rel = await downloadPhoto(ctx, fileId, 'sights', s.key, 1);
      const sights = C.loadSights(); const st = sights[s.key];
      if (!st) { sessions.delete(ctx.from.id); return ctx.reply('⚠️ Sight not found.'); }
      if (st.photo && String(st.photo).startsWith('images/')) delFile(st.photo);
      st.photo = rel; C.saveSights(sights);
      sessions.delete(ctx.from.id);
      const v = sightView(s.key);
      return ctx.reply('✅ Photo updated. Site updated.\n\n' + v.text, { ...md, reply_markup: v.kb });
    }
  } catch (e) { console.error(e); await ctx.reply('⚠️ Could not save that photo. Try again.'); }
});

// ---------- save drafts ----------
async function saveTourDraft(ctx, s) {
  const tours = C.loadTours(); const d = s.draft;
  d.id = C.nextId(tours); if (!d.slug) d.slug = C.uniqueSlug(d.name, tours);
  d.status = 'draft'; // new content starts as a draft; publish it from 📝 Drafts
  tours.unshift(d); C.saveTours(tours); sessions.delete(ctx.from.id);
  await ctx.reply(`📝 <b>Saved as a draft</b> — "${esc(d.name)}" is NOT live yet.\nReview it in 📝 Drafts (/drafts) and tap Publish when it's ready.`, md);
}
async function savePostDraft(ctx, s) {
  const posts = C.loadPosts(); const d = s.draft;
  d.id = C.nextPostId(posts); if (!d.slug) d.slug = C.uniquePostSlug(d.title, posts);
  if (!d.date) d.date = new Date().toISOString().slice(0, 10);
  if (!d.cover) d.cover = 'img/hero/hero-1-reflection-1400.jpg';
  d.status = 'draft'; // new content starts as a draft; publish it from 📝 Drafts
  posts.unshift(d); C.savePosts(posts); sessions.delete(ctx.from.id);
  await ctx.reply(`📝 <b>Saved as a draft</b> — "${esc(d.title)}" is NOT live yet.\nReview it in 📝 Drafts (/drafts) and tap Publish when it's ready.`, md);
}

// ================= GUIDES =================
const GUIDE_FIELDS = [['name', 'Name'], ['role', 'Role'], ['languages', 'Languages'], ['bio', 'Bio']];
function guideListKb() {
  const gs = C.loadGuides(); const kb = new InlineKeyboard();
  gs.forEach(g => kb.text(`${g.name} — ${g.role}`.slice(0, 45), `g:v:${g.id}`).row());
  if (gs.length) kb.text('🔎 Search', 'xsearch:guide').row();
  kb.text('➕ New guide', 'g:add');
  return { text: `🧭 <b>${gs.length} guides</b> — tap one:`, kb };
}
function guideView(id) {
  const g = C.loadGuides().find(x => x.id === id); if (!g) return null;
  const revs = C.loadReviews().filter(r => r.placement === 'guide:' + id).length;
  const kb = new InlineKeyboard().text('✏️ Edit', `g:e:${id}`).text('🖼 Photo', `g:photo:${id}`).row().text('🗑 Delete', `g:del:${id}`).text('« Back', 'g:list');
  return { info: `${b(g.name)}\n${esc(g.role)}\n🗣 ${esc((g.languages || []).join(' · '))} · ⭐ ${revs} review(s)\n\n${esc(g.bio || '')}`, kb };
}
function guideEditKb(id) { const kb = new InlineKeyboard(); GUIDE_FIELDS.forEach(([f, l], i) => { kb.text(l, `g:ef:${id}:${f}`); if (i % 2) kb.row(); }); kb.row().text('« Back', `g:v:${id}`); return kb; }

bot.command('guides', ctx => { const { text, kb } = guideListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.command('addguide', ctx => { sessions.set(ctx.from.id, { mode: 'addguide', step: 'name', draft: C.blankGuide() }); ctx.reply('🆕 <b>New guide</b>\n\nGuide <b>name</b>?', md); });
bot.callbackQuery('g:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = guideListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('g:add', async ctx => { await ctx.answerCallbackQuery(); sessions.set(ctx.from.id, { mode: 'addguide', step: 'name', draft: C.blankGuide() }); await ctx.reply('🆕 <b>New guide</b>\n\nGuide <b>name</b>?', md); });
bot.callbackQuery(/^g:v:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = guideView(Number(ctx.match[1])); if (!v) return ctx.reply('Not found.'); await ctx.reply(v.info, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^g:e:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('Which field?', { reply_markup: guideEditKb(Number(ctx.match[1])) }); });
bot.callbackQuery(/^g:ef:(\d+):(\w+)$/, async ctx => {
  const id = Number(ctx.match[1]), field = ctx.match[2]; await ctx.answerCallbackQuery();
  const g = C.loadGuides().find(x => x.id === id);
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'guide', id, field });
  await ask(ctx, `✏️ ${b(g ? g.name : 'guide')} → send the new ${b((GUIDE_FIELDS.find(f => f[0] === field) || [, field])[1])}${field === 'languages' ? ' (e.g. <code>KG RU EN</code>)' : ''}:`);
});
bot.callbackQuery(/^g:photo:(\d+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'guidephoto', id: Number(ctx.match[1]) }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send the new guide photo.'); });
bot.callbackQuery(/^g:del:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Delete this guide?', { reply_markup: new InlineKeyboard().text('✅ Yes', `g:delyes:${id}`).text('Cancel', `g:v:${id}`) }); });
bot.callbackQuery(/^g:delyes:(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery({ text: 'Deleted' });
  const gs = C.loadGuides(); const g = gs.find(x => x.id === id); C.saveGuides(gs.filter(x => x.id !== id));
  let moved = 0; const rs = C.loadReviews(); rs.forEach(r => { if (r.placement === 'guide:' + id) { r.placement = 'reviews'; moved++; } }); if (moved) C.saveReviews(rs);
  await ctx.reply(`🗑 Deleted ${b(g ? g.name : id)}. Site updated.${moved ? `\n${moved} review(s) moved to the Reviews page.` : ''}`, md);
});

// ================= REVIEWS =================
const REVIEW_FIELDS = [['name', 'Name'], ['country', 'Country'], ['text', 'Text'], ['rating', 'Rating']];
const placeLabel = p => { if (p === 'home') return '🏠 Home'; if (p === 'reviews') return '⭐ Reviews page'; if (p && p.startsWith('guide:')) { const g = C.loadGuides().find(x => x.id === Number(p.slice(6))); return '🧭 ' + (g ? g.name : p); } if (p && p.startsWith('tour:')) return '🏔 ' + p.slice(5); return p; };
function placementKb(prefix) {
  const kb = new InlineKeyboard();
  kb.text('🏠 Home', `${prefix}:home`).text('⭐ Reviews page', `${prefix}:reviews`).row();
  C.loadGuides().forEach(g => kb.text('About: ' + g.name, `${prefix}:guide:${g.id}`).row());
  kb.text('🏔 A specific tour', `${prefix}:tour`);
  return kb;
}
// pick a tour from a list instead of typing its slug
function tourPickKb(prefix) {
  const kb = new InlineKeyboard();
  C.loadTours().slice(0, 60).forEach(t => kb.text(t.name.slice(0, 40), `${prefix}:${t.slug}`).row());
  return kb;
}
function reviewListKb() {
  const rs = C.loadReviews(); const kb = new InlineKeyboard();
  rs.slice(0, 40).forEach(r => kb.text(`${r.name} · ${placeLabel(r.placement)}`.slice(0, 45), `r:v:${r.id}`).row());
  if (rs.length) kb.text('🔎 Search', 'xsearch:review').row();
  kb.text('➕ New review', 'r:add');
  const more = rs.length > 40 ? ` (showing 40 — use 🔎 to find the rest)` : '';
  return { text: `⭐ <b>${rs.length} reviews</b>${more} — tap one:`, kb };
}
function reviewView(id) {
  const r = C.loadReviews().find(x => x.id === id); if (!r) return null;
  const kb = new InlineKeyboard().text('✏️ Edit', `r:e:${id}`).text('📍 Where shown', `r:place:${id}`).row().text('🗑 Delete', `r:del:${id}`).text('« Back', 'r:list');
  return { info: `${b(r.name)} (${esc(r.country || '—')})\n${'★'.repeat(r.rating || 5)} · shown on ${esc(placeLabel(r.placement))}\n\n"${esc((r.text || '').slice(0, 350))}"`, kb };
}
function reviewEditKb(id) { const kb = new InlineKeyboard(); REVIEW_FIELDS.forEach(([f, l], i) => { kb.text(l, `r:ef:${id}:${f}`); if (i % 2) kb.row(); }); kb.row().text('« Back', `r:v:${id}`); return kb; }

bot.command('reviews', ctx => { const { text, kb } = reviewListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.command('addreview', ctx => { sessions.set(ctx.from.id, { mode: 'addreview', step: 'name', draft: C.blankReview() }); ctx.reply('🆕 <b>New review</b>\n\nGuest <b>name</b>?', md); });
bot.callbackQuery('r:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = reviewListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('r:add', async ctx => { await ctx.answerCallbackQuery(); sessions.set(ctx.from.id, { mode: 'addreview', step: 'name', draft: C.blankReview() }); await ctx.reply('🆕 <b>New review</b>\n\nGuest <b>name</b>?', md); });
bot.callbackQuery(/^r:v:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = reviewView(Number(ctx.match[1])); if (!v) return ctx.reply('Not found.'); await ctx.reply(v.info, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^r:e:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('Which field?', { reply_markup: reviewEditKb(Number(ctx.match[1])) }); });
bot.callbackQuery(/^r:ef:(\d+):(\w+)$/, async ctx => {
  const id = Number(ctx.match[1]), field = ctx.match[2]; await ctx.answerCallbackQuery();
  const r = C.loadReviews().find(x => x.id === id);
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'review', id, field });
  await ask(ctx, `✏️ ${b(r ? 'review by ' + r.name : 'review')} → send the new ${b((REVIEW_FIELDS.find(f => f[0] === field) || [, field])[1])}${field === 'rating' ? ' (1–5)' : ''}:`);
});
bot.callbackQuery(/^r:place:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Where should this review show?', { reply_markup: placementKb(`rsp:${id}`) }); });
bot.callbackQuery(/^rsp:(\d+):(.+)$/, async ctx => {
  const id = Number(ctx.match[1]); let val = ctx.match[2]; await ctx.answerCallbackQuery();
  if (val === 'tour') return ctx.reply('Pick the tour:', { reply_markup: tourPickKb(`rspt:${id}`) });
  const rs = C.loadReviews(); const r = rs.find(x => x.id === id); if (r) { r.placement = val; C.saveReviews(rs); }
  await ctx.reply(`✅ Now shown on ${esc(placeLabel(val))}. Site updated.`, md);
});
bot.callbackQuery(/^rspt:(\d+):(.+)$/, async ctx => {
  const id = Number(ctx.match[1]); const slug = ctx.match[2]; await ctx.answerCallbackQuery();
  const rs = C.loadReviews(); const r = rs.find(x => x.id === id); if (r) { r.placement = 'tour:' + slug; C.saveReviews(rs); }
  await ctx.reply(`✅ Now shown on ${esc(placeLabel('tour:' + slug))}. Site updated.`, md);
});
bot.callbackQuery(/^r:del:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Delete this review?', { reply_markup: new InlineKeyboard().text('✅ Yes', `r:delyes:${id}`).text('Cancel', `r:v:${id}`) }); });
bot.callbackQuery(/^r:delyes:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery({ text: 'Deleted' }); const rs = C.loadReviews(); const r = rs.find(x => x.id === id); C.saveReviews(rs.filter(x => x.id !== id)); await ctx.reply(`🗑 Deleted review by ${b(r ? r.name : id)}. Site updated.`, md); });

// addreview rating + placement (wizard)
bot.callbackQuery(/^rrate:(\d)$/, async ctx => {
  const s = sessions.get(ctx.from.id); await ctx.answerCallbackQuery();
  if (!s || s.mode !== 'addreview') return;
  s.draft.rating = Number(ctx.match[1]); s.step = 'placement';
  await ctx.reply('Where should this review show?', { reply_markup: placementKb('rwp') });
});
bot.callbackQuery(/^rwp:(.+)$/, async ctx => {
  const s = sessions.get(ctx.from.id); const val = ctx.match[1]; await ctx.answerCallbackQuery();
  if (!s || s.mode !== 'addreview') return;
  if (val === 'tour') return ctx.reply('Pick the tour:', { reply_markup: tourPickKb('rwpt') });
  s.draft.placement = val; s.step = 'photo';
  await ctx.reply('📷 Optional: send a guest <b>photo</b>, or /done to finish.', md);
});
bot.callbackQuery(/^rwpt:(.+)$/, async ctx => {
  const s = sessions.get(ctx.from.id); const slug = ctx.match[1]; await ctx.answerCallbackQuery();
  if (!s || s.mode !== 'addreview') return;
  s.draft.placement = 'tour:' + slug; s.step = 'photo';
  await ctx.reply('📷 Optional: send a guest <b>photo</b>, or /done to finish.', md);
});

// ---------- save guide/review drafts ----------
async function saveGuideDraft(ctx, s) {
  const gs = C.loadGuides(); const d = s.draft;
  d.id = C.nextGuideId(gs); gs.push(d); C.saveGuides(gs); sessions.delete(ctx.from.id);
  await ctx.reply(`🎉 Guide ${b(d.name)} added. ${gs.length} total. /guides to manage.`, md);
}
async function saveReviewDraft(ctx, s) {
  const rs = C.loadReviews(); const d = s.draft;
  d.id = C.nextReviewId(rs);
  if (!d.avatar) d.avatar = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80';
  rs.unshift(d); C.saveReviews(rs); sessions.delete(ctx.from.id);
  await ctx.reply(`🎉 Review by ${b(d.name)} added, shown on ${esc(placeLabel(d.placement))}. /reviews to manage.`, md);
}

// ================= HOMEPAGE MEDIA (site settings) =================
const EXP_SLOTS = ['Combined adventures', 'Road trips', 'Horse treks', 'Off the beaten path', 'Winter tours'];
function homeKb() {
  return new InlineKeyboard()
    .text('📸 Instagram grid', 'h:ig').row()
    .text('🧭 Experience cards', 'h:exp').row()
    .text('🏔 Hero photo', 'h:heroset').text('🧩 Builder photos', 'h:builder').row();
}
function builderView() {
  const bp = (C.loadSite().builder) || [];
  const kb = new InlineKeyboard();
  for (let i = 0; i < 4; i++) kb.text(`${bp[i] ? '🖼' : '➕'} Photo ${i + 1}`, `h:builderset:${i}`).row();
  kb.text('« Back', 'h:home').row();
  return { text: `🧩 <b>Builder teaser</b> (homepage “Build it” block) — 4 photos.\nTap one to replace. ${bp.filter(Boolean).length}/4 set.`, kb };
}
function expView() {
  const exps = (C.loadSite().experiences) || [];
  const kb = new InlineKeyboard();
  EXP_SLOTS.forEach((label, i) => {
    kb.text(`${exps[i] ? '🖼' : '➕'} ${label}`, `h:expset:${i}`).row();
  });
  kb.text('« Back', 'h:home').row();
  return { text: `🧭 <b>Experience cards</b> (homepage)\nTap a card to replace its photo. ${exps.filter(Boolean).length}/${EXP_SLOTS.length} set.`, kb };
}
function igView() {
  const ig = (C.loadSite().instagram) || {};
  const photos = ig.photos || [];
  const kb = new InlineKeyboard();
  photos.forEach((p, i) => {
    kb.text(`${i === 0 ? '⭐' : '🖼'} ${i + 1}`, 'h:noop').text('⭐', `h:igmain:${i}`).text('🔼', `h:igup:${i}`).text('🔽', `h:igdn:${i}`).text('🗑', `h:igdel:${i}`).row();
  });
  if (photos.length) kb.text('🔄 Show photos', 'h:igshow').row();
  kb.text('➕ Add photo', 'h:igadd').row();
  kb.text('✏️ Instagram link', 'h:igurl').text('« Back', 'h:home').row();
  const text = `📸 <b>Instagram grid</b> — ${photos.length} photo(s)\n🔗 Link: ${ig.url ? esc(ig.url) : '<i>(not set)</i>'}\n\n⭐ = shown first · 🔼🔽 reorder. Add with ➕. These appear in the “Follow the journey” block on the homepage.`;
  return { text, kb };
}
bot.command('home', ctx => ctx.reply('🏠 <b>Homepage photos</b>\n\nManage the images shown on the front page.', { ...md, reply_markup: homeKb() }));
bot.callbackQuery('h:home', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('🏠 <b>Homepage photos</b>', { ...md, reply_markup: homeKb() }); });
bot.callbackQuery('h:noop', ctx => ctx.answerCallbackQuery());
bot.callbackQuery('h:ig', async ctx => { await ctx.answerCallbackQuery(); const ig = (C.loadSite().instagram) || {}; await sendAlbum(ctx, ig.photos); const v = igView(); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery('h:igshow', async ctx => { await ctx.answerCallbackQuery(); const ig = (C.loadSite().instagram) || {}; await sendAlbum(ctx, ig.photos); });
bot.callbackQuery(/^h:igup:(\d+)$/, async ctx => {
  const i = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const site = C.loadSite(); const ph = (site.instagram && site.instagram.photos) || [];
  if (i > 0 && ph[i]) { [ph[i - 1], ph[i]] = [ph[i], ph[i - 1]]; C.saveSite(site); }
  const v = igView(); await ctx.reply(v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^h:igdn:(\d+)$/, async ctx => {
  const i = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const site = C.loadSite(); const ph = (site.instagram && site.instagram.photos) || [];
  if (i < ph.length - 1) { [ph[i + 1], ph[i]] = [ph[i], ph[i + 1]]; C.saveSite(site); }
  const v = igView(); await ctx.reply(v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery('h:igadd', async ctx => { sessions.set(ctx.from.id, { mode: 'sitephoto', target: 'instagram' }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send the photo(s) for the Instagram grid, then /home.'); });
bot.callbackQuery('h:igurl', async ctx => { sessions.set(ctx.from.id, { mode: 'editfield', kind: 'site', field: 'instagram.url' }); await ctx.answerCallbackQuery(); await ask(ctx, '🔗 Send your Instagram link (e.g. <code>https://www.instagram.com/azattourskg/</code>):'); });
bot.callbackQuery(/^h:igdel:(\d+)$/, async ctx => {
  const idx = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  await ctx.reply(`Delete Instagram photo ${idx + 1}? This can't be undone.`, { reply_markup: new InlineKeyboard().text('🗑 Yes, delete', `h:igdelyes:${idx}`).text('« Keep', 'h:ig') });
});
bot.callbackQuery(/^h:igdelyes:(\d+)$/, async ctx => {
  const idx = Number(ctx.match[1]); await ctx.answerCallbackQuery({ text: 'Deleted' });
  const site = C.loadSite(); const photos = (site.instagram && site.instagram.photos) || [];
  if (photos[idx]) { if (String(photos[idx]).startsWith('images/')) delFile(photos[idx]); photos.splice(idx, 1); C.saveSite(site); }
  const v = igView(); await ctx.reply('🗑 Removed.\n\n' + v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery(/^h:igmain:(\d+)$/, async ctx => {
  const idx = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const site = C.loadSite(); const photos = (site.instagram && site.instagram.photos) || [];
  if (photos[idx]) { const [p] = photos.splice(idx, 1); photos.unshift(p); C.saveSite(site); }
  const v = igView(); await ctx.reply('⭐ Moved to first.\n\n' + v.text, { ...md, reply_markup: v.kb });
});
bot.callbackQuery('h:exp', async ctx => { await ctx.answerCallbackQuery(); const v = expView(); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^h:expset:(\d+)$/, async ctx => {
  const i = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'sitephoto', target: 'experience', idx: i });
  await ctx.answerCallbackQuery(); await ask(ctx, `📷 Send the new photo for ${b(EXP_SLOTS[i] || ('card ' + (i + 1)))}.`);
});
bot.callbackQuery('h:heroset', async ctx => { sessions.set(ctx.from.id, { mode: 'sitephoto', target: 'hero' }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send the new <b>hero</b> (top banner) photo. Wide/landscape works best.'); });
bot.callbackQuery('h:builder', async ctx => { await ctx.answerCallbackQuery(); const v = builderView(); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^h:builderset:(\d+)$/, async ctx => { const i = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'sitephoto', target: 'builder', idx: i }); await ctx.answerCallbackQuery(); await ask(ctx, `📷 Send builder photo <b>${i + 1}</b>.`); });

// ================= SIGHTS (photos + captions for "Sights visited on this tour") =================
function sightsListKb() {
  const sights = C.loadSights();
  const keys = Object.keys(sights);
  const kb = new InlineKeyboard();
  keys.forEach(k => {
    const s = sights[k] || {};
    const mark = s.photo && String(s.photo).startsWith('images/') ? '✅' : (s.photo ? '🌐' : '▫️');
    kb.text(`${mark} ${s.name || k}`, `sg:v:${k}`).row();
  });
  kb.text('➕ Add place', 'sg:add').row();
  const text = `📍 <b>Sights</b> — ${keys.length} place(s) shown in the “Sights visited on this tour” section of every tour.\n\n✅ = your photo · 🌐 = placeholder · ▫️ = no photo (a tour photo is used).\nTap a place to edit, or add a new one.`;
  return { text, kb };
}
function sightView(key) {
  const s = (C.loadSights())[key];
  if (!s) return null;
  const kb = new InlineKeyboard()
    .text('📷 Replace photo', `sg:ph:${key}`).row()
    .text('✏️ Edit description', `sg:bl:${key}`).text('✏️ Rename', `sg:name:${key}`).row()
    .text('🗑 Delete place', `sg:del:${key}`).text('« All sights', 'sg:list').row();
  const photoLine = s.photo
    ? (String(s.photo).startsWith('images/') ? `🖼 Your photo is set` : '🌐 Placeholder photo (replace it with your own)')
    : '▫️ No photo yet — a tour photo is shown as a fallback';
  const text = `📍 ${b(s.name || key)}\n\n${photoLine}\n📝 ${s.blurb ? esc(s.blurb) : '<i>(no description)</i>'}`;
  return { text, kb };
}
bot.command('sights', ctx => { const { text, kb } = sightsListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('sg:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = sightsListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery(/^sg:v:(.+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = sightView(ctx.match[1]); if (!v) return ctx.reply('Not found.'); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^sg:ph:(.+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'sightphoto', key: ctx.match[1] }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send the new photo for this place.'); });
bot.callbackQuery(/^sg:bl:(.+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'sightblurb', key: ctx.match[1] }); await ctx.answerCallbackQuery(); await ask(ctx, '✏️ Send a short one-line description for this place.'); });
bot.callbackQuery('sg:add', async ctx => { sessions.set(ctx.from.id, { mode: 'sightadd' }); await ctx.answerCallbackQuery(); await ask(ctx, '➕ What is the <b>name</b> of the place? (e.g. Song-Köl Lake)'); });
bot.callbackQuery(/^sg:name:(.+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'sightname', key: ctx.match[1] }); await ctx.answerCallbackQuery(); await ask(ctx, '✏️ Send the new <b>name</b> for this place:'); });
bot.callbackQuery(/^sg:del:(.+)$/, async ctx => { const key = ctx.match[1]; await ctx.answerCallbackQuery(); await ctx.reply('Delete this place? This can\'t be undone.', { reply_markup: new InlineKeyboard().text('🗑 Yes, delete', `sg:delyes:${key}`).text('« Keep', `sg:v:${key}`) }); });
bot.callbackQuery(/^sg:delyes:(.+)$/, async ctx => {
  const key = ctx.match[1]; await ctx.answerCallbackQuery({ text: 'Deleted' });
  const sights = C.loadSights(); const s = sights[key];
  if (s) { if (s.photo && String(s.photo).startsWith('images/')) delFile(s.photo); delete sights[key]; C.saveSights(sights); }
  const { text, kb } = sightsListKb(); await ctx.reply('🗑 Place removed.\n\n' + text, { ...md, reply_markup: kb });
});

bot.catch(async (err) => {
  console.error('Bot error:', err);
  // Don't fail silently: tell the owner their last action may not have gone through.
  try { await err.ctx.reply('⚠️ Something went wrong. Your last action may not have been saved — please try again.'); } catch (e) { /* replying itself failed */ }
});

const BOT_COMMANDS = [
  { command: 'start', description: 'Open the admin menu' },
  { command: 'home', description: 'Homepage photos (Instagram, hero, cards)' },
  { command: 'tours', description: 'Manage tours' },
  { command: 'addtour', description: 'Add a tour' },
  { command: 'posts', description: 'Manage blog articles' },
  { command: 'addpost', description: 'Add an article' },
  { command: 'guides', description: 'Manage guides' },
  { command: 'reviews', description: 'Manage reviews' },
  { command: 'sights', description: 'Sights photos & captions' },
  { command: 'drafts', description: 'Content waiting to publish' },
  { command: 'leads', description: 'Recent enquiries' },
  { command: 'chats', description: 'Website chats' },
  { command: 'help', description: 'Help' },
  { command: 'cancel', description: 'Cancel current action' },
];
bot.start({
  drop_pending_updates: true, // skip backlog so /start answers instantly after a restart
  onStart: async info => {
    try { await bot.api.setMyCommands(BOT_COMMANDS); } catch (e) { console.error('setMyCommands failed:', e.message); }
    if (!OWNER_ID) console.warn('⚠️  OWNER_ID is not set — the FIRST person to /start will become admin. Set ownerId in config.json (or OWNER_ID env) before exposing the bot.');
    console.log(`✅ Azat Tours admin bot running as @${info.username}. Owner: ${OWNER_ID || '(unclaimed)'}`);
  }
});
