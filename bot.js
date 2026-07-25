// Azat Tours Telegram admin bot — manage tours AND blog from your phone.
// Setup: put your token + ownerId in config.json (first /start auto-claims owner).
// Run:  node bot.js
const fs = require('fs');
const path = require('path');
const { Bot, InlineKeyboard } = require('grammy');
const C = require('./lib/content');
const store = require('./lib/store');

// ---------- config ----------
const CONFIG_PATH = path.join(__dirname, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
const TOKEN = process.env.BOT_TOKEN || cfg.token;
let OWNER_ID = Number(process.env.OWNER_ID || cfg.ownerId) || 0;
function setOwner(id) {
  OWNER_ID = id;
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify({ token: TOKEN, ownerId: id }, null, 2)); } catch (e) {}
}
if (!TOKEN || TOKEN.includes('PASTE-')) {
  console.error('\n⚠️  No bot token. Put it in config.json, then run: node bot.js\n');
  process.exit(1);
}

const bot = new Bot(TOKEN);
const sessions = new Map(); // userId -> state

const TOUR_CATS = ['Combined', 'Horse riding', 'Road trip', 'Off-the-beaten-path', 'Winter tours'];
const POST_CATS = ['Travel guide', 'Planning', 'Culture', 'Practical', 'Gear', 'Horse treks', 'Day tours'];
const TOUR_FIELDS = [['name', 'Name'], ['category', 'Category'], ['duration', 'Duration'], ['summary', 'Description'], ['season', 'Best season'], ['start_from', 'Starts in'], ['highlights', 'Highlights'], ['tags', 'Tags']];
const POST_FIELDS = [['title', 'Title'], ['category', 'Category'], ['excerpt', 'Excerpt'], ['author', 'Author'], ['body', 'Body text']];

// ---------- auth ----------
bot.use(async (ctx, next) => {
  const id = ctx.from && ctx.from.id;
  if (OWNER_ID && id !== OWNER_ID) { if (ctx.reply) await ctx.reply('⛔ This is a private admin bot.'); return; }
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

// ================= TOURS =================
function tourListKb() {
  const tours = C.loadTours();
  const kb = new InlineKeyboard();
  tours.slice(0, 40).forEach(t => kb.text(t.name.slice(0, 45), `t:v:${t.id}`).row());
  return { text: `📋 <b>${tours.length} tours</b> — tap one:`, kb };
}
function tourView(id) {
  const t = C.loadTours().find(x => x.id === id);
  if (!t) return null;
  const kb = new InlineKeyboard()
    .text('✏️ Edit text', `t:e:${id}`).text('🖼 Photos', `t:ph:${id}`).row()
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
  const kb = new InlineKeyboard();
  (t.images || []).forEach((img, i) => {
    kb.text(`${i === 0 ? '⭐' : '🖼'} ${i + 1}`, `t:noop`).text('⭐ main', `t:phmain:${id}:${i}`).text('🗑', `t:phdel:${id}:${i}`).row();
  });
  kb.text('➕ Add photos', `t:phadd:${id}`).row().text('« Back', `t:v:${id}`);
  return { text: `🖼 ${b(t.name)} — ${(t.images || []).length} photo(s)\n⭐ = main (shown first). Send new ones with ➕.`, kb };
}

// ================= POSTS =================
function postListKb() {
  const posts = C.loadPosts();
  const kb = new InlineKeyboard();
  posts.forEach(p => kb.text(p.title.slice(0, 45), `p:v:${p.id}`).row());
  kb.text('➕ New article', 'p:add').row();
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
const MENU_TEXT = '🏔️ <b>Azat Tours admin bot</b>\n\nTap a section below — or type a command (see the “/” menu). /help for details.';
function mainMenuKb() {
  return new InlineKeyboard()
    .text('🏔 Tours', 't:list').text('📰 Blog', 'p:list').row()
    .text('🧭 Guides', 'g:list').text('⭐ Reviews', 'r:list').row()
    .text('🏠 Homepage photos', 'h:home').row()
    .text('📨 Leads', 'm:leads').text('💬 Chats', 'm:chats').row();
}
bot.command('start', async ctx => {
  if (!OWNER_ID) { setOwner(ctx.from.id); await ctx.reply(`✅ You are now the admin (ID ${ctx.from.id}).`); }
  await ctx.reply(MENU_TEXT, { ...md, reply_markup: mainMenuKb() });
});
bot.command('menu', ctx => ctx.reply(MENU_TEXT, { ...md, reply_markup: mainMenuKb() }));
bot.callbackQuery('m:home', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply(MENU_TEXT, { ...md, reply_markup: mainMenuKb() }); });
bot.callbackQuery('m:leads', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply(leadsText(), md); });
bot.callbackQuery('m:chats', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply(chatsText(), md); });
bot.command('help', ctx => ctx.reply(
  'TOURS\n/tours — list, view, edit text, manage photos, delete\n/addtour — new tour wizard\n\n' +
  'BLOG\n/posts — list, view, edit, cover & gallery, delete\n/addpost — new article wizard\n\n' +
  'Editing: tap a field, then send the new value. Add photos by sending them, then /done.\n' +
  'Formatting in article body: "## Heading", "- list item", "&gt; quote", "**bold**", "[img:URL|caption]", "[tip:Title|Text]".'
));

bot.command('tours', ctx => { const { text, kb } = tourListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.command('posts', ctx => { const { text, kb } = postListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });

// recent leads
function leadsText() {
  const leads = store.listLeads(12);
  if (!leads.length) return 'No leads yet. They will appear here the moment someone submits a form.';
  const fmt = l => `• ${b(l.name || '—')} — ${esc(l.email || '—')}\n  ${esc([l.tour, l.people && l.people + ' ppl', l.dates].filter(Boolean).join(' · '))}${l.msg ? '\n  💬 ' + esc(l.msg) : ''}${l.trip_summary ? '\n  ' + esc(l.trip_summary.replace(/\n/g, ' ')) : ''}`;
  return '📨 <b>Recent leads</b>\n\n' + leads.map(fmt).join('\n\n');
}
bot.command('leads', ctx => ctx.reply(leadsText(), md));

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
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'tour', id, field });
  const hint = field === 'highlights' ? ' (comma-separated)' : '';
  await ctx.reply(`Send the new ${b((TOUR_FIELDS.find(f => f[0] === field) || [, field])[1])}${hint}:`, md);
});
bot.callbackQuery(/^t:setcat:(\d+):(.+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const tours = C.loadTours(); const t = tours.find(x => x.id === id);
  if (t) { t.category = ctx.match[2]; t.cats = [ctx.match[2]]; C.saveTours(tours); }
  await ctx.reply(`✅ Category set to ${b(ctx.match[2])}. Site updated.`, md);
});
bot.callbackQuery(/^t:ph:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = tourPhotosView(Number(ctx.match[1])); if (v) await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^t:phadd:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'addphotos', kind: 'tour', id }); await ctx.answerCallbackQuery(); await ctx.reply('📷 Send photos now. /done when finished.'); });
bot.callbackQuery(/^t:phdel:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery();
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
  await ctx.reply(`🗑 Deleted ${b(t ? t.name : id)}. Site updated.`, md);
});

// ---------- post callbacks ----------
bot.callbackQuery('p:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = postListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('p:add', async ctx => { await ctx.answerCallbackQuery(); sessions.set(ctx.from.id, { mode: 'addpost', step: 'title', draft: C.blankPost() }); await ctx.reply('🆕 <b>New article</b>\n\nArticle <b>title</b>?', md); });
bot.callbackQuery(/^p:v:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = postView(Number(ctx.match[1])); if (!v) return ctx.reply('Not found.'); await ctx.reply(v.info, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^p:e:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('Which field to edit?', { reply_markup: postEditKb(Number(ctx.match[1])) }); });
bot.callbackQuery(/^p:ef:(\d+):(\w+)$/, async ctx => {
  const id = Number(ctx.match[1]), field = ctx.match[2]; await ctx.answerCallbackQuery();
  if (field === 'category') { const kb = new InlineKeyboard(); POST_CATS.forEach((c, i) => { kb.text(c, `p:setcat:${id}:${c}`); if (i % 2) kb.row(); }); return ctx.reply('Pick a category:', { reply_markup: kb }); }
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'post', id, field });
  const hint = field === 'body' ? '\n\n<i>You can use ## headings, - lists, &gt; quotes, **bold**, [img:URL|caption], [tip:Title|Text].</i>' : '';
  await ctx.reply(`Send the new ${b((POST_FIELDS.find(f => f[0] === field) || [, field])[1])}:${hint}`, md);
});
bot.callbackQuery(/^p:setcat:(\d+):(.+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  if (p) { p.category = ctx.match[2]; C.savePosts(posts); }
  await ctx.reply(`✅ Category set to ${b(ctx.match[2])}.`, md);
});
bot.callbackQuery(/^p:cover:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'setcover', id }); await ctx.answerCallbackQuery(); await ctx.reply('📷 Send the new cover photo.'); });
bot.callbackQuery(/^p:ph:(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]); await ctx.answerCallbackQuery();
  const p = C.loadPosts().find(x => x.id === id); if (!p) return;
  const kb = new InlineKeyboard();
  (p.images || []).forEach((img, i) => kb.text(`🏞 ${i + 1}`, 'p:noop').text('🗑', `p:phdel:${id}:${i}`).row());
  kb.text('➕ Add photos', `p:phadd:${id}`).row().text('« Back', `p:v:${id}`);
  await ctx.reply(`🏞 ${b(p.title)} — ${(p.images || []).length} gallery photo(s).`, { ...md, reply_markup: kb });
});
bot.callbackQuery('p:noop', ctx => ctx.answerCallbackQuery());
bot.callbackQuery(/^p:phadd:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'addphotos', kind: 'post', id }); await ctx.answerCallbackQuery(); await ctx.reply('📷 Send gallery photos. /done when finished.'); });
bot.callbackQuery(/^p:phdel:(\d+):(\d+)$/, async ctx => {
  const id = Number(ctx.match[1]), idx = Number(ctx.match[2]); await ctx.answerCallbackQuery();
  const posts = C.loadPosts(); const p = posts.find(x => x.id === id);
  if (p && p.images[idx]) { if (p.images[idx].startsWith('images/')) delFile(p.images[idx]); p.images.splice(idx, 1); C.savePosts(posts); }
  await ctx.reply('🗑 Removed.');
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

  // edit a single field on an existing item
  if (s.mode === 'editfield') {
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

  // edit a sight's description
  if (s.mode === 'sightblurb') {
    const sights = C.loadSights(); const st = sights[s.key];
    if (!st) { sessions.delete(ctx.from.id); return; }
    st.blurb = txt.trim(); C.saveSights(sights);
    sessions.delete(ctx.from.id);
    const v = sightView(s.key);
    return ctx.reply('✅ Description saved. Site updated.\n\n' + v.text, { ...md, reply_markup: v.kb });
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
    if (s.step === 'cover' && txt.trim().toLowerCase() === 'skip') { s.draft.cover = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2000&q=80'; s.step = 'body'; return ctx.reply('✍️ Now send the <b>article body</b>.\n\n<i>Use ## headings, - lists, &gt; quotes, **bold**, [img:URL|caption], [tip:Title|Text]. First paragraph becomes the intro.</i>', md); }
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
    if (s.step === 'text') { s.draft.text = txt.trim(); s.step = 'rating'; const kb = new InlineKeyboard(); [5, 4, 3].forEach(n => kb.text('★'.repeat(n), `rrate:${n}`)); return ctx.reply('Rating?', { reply_markup: kb }); }
    if (s.step === 'tourslug') { s.draft.placement = 'tour:' + txt.trim(); s.step = 'photo'; return ctx.reply('📷 Optional: send a guest <b>photo</b>, or /done to finish.', md); }
  }

  // set an existing review to a specific tour page
  if (s.mode === 'reviewslug') {
    const rs = C.loadReviews(); const r = rs.find(x => x.id === s.id);
    if (r) { r.placement = 'tour:' + txt.trim(); C.saveReviews(rs); }
    sessions.delete(ctx.from.id);
    return ctx.reply('✅ Now shown on that tour page. Site updated.');
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
  tours.unshift(d); C.saveTours(tours); sessions.delete(ctx.from.id);
  await ctx.reply(`🎉 <b>Saved!</b> "${esc(d.name)}" is live.\n${d.images.length} photo(s) · ${tours.length} tours total.\n/tours to manage.`, md);
}
async function savePostDraft(ctx, s) {
  const posts = C.loadPosts(); const d = s.draft;
  d.id = C.nextPostId(posts); if (!d.slug) d.slug = C.uniquePostSlug(d.title, posts);
  if (!d.date) d.date = new Date().toISOString().slice(0, 10);
  if (!d.cover) d.cover = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2000&q=80';
  posts.unshift(d); C.savePosts(posts); sessions.delete(ctx.from.id);
  await ctx.reply(`🎉 <b>Published!</b> "${esc(d.title)}" is live on the blog.\n${d.images.length} gallery photo(s) · ${posts.length} articles total.\n/posts to manage.`, md);
}

// ================= GUIDES =================
const GUIDE_FIELDS = [['name', 'Name'], ['role', 'Role'], ['languages', 'Languages'], ['bio', 'Bio']];
function guideListKb() {
  const gs = C.loadGuides(); const kb = new InlineKeyboard();
  gs.forEach(g => kb.text(`${g.name} — ${g.role}`.slice(0, 45), `g:v:${g.id}`).row());
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
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'guide', id, field });
  await ctx.reply(`Send the new ${b((GUIDE_FIELDS.find(f => f[0] === field) || [, field])[1])}${field === 'languages' ? ' (e.g. <code>KG RU EN</code>)' : ''}:`, md);
});
bot.callbackQuery(/^g:photo:(\d+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'guidephoto', id: Number(ctx.match[1]) }); await ctx.answerCallbackQuery(); await ctx.reply('📷 Send the new guide photo.'); });
bot.callbackQuery(/^g:del:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Delete this guide?', { reply_markup: new InlineKeyboard().text('✅ Yes', `g:delyes:${id}`).text('Cancel', `g:v:${id}`) }); });
bot.callbackQuery(/^g:delyes:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery({ text: 'Deleted' }); const gs = C.loadGuides(); const g = gs.find(x => x.id === id); C.saveGuides(gs.filter(x => x.id !== id)); await ctx.reply(`🗑 Deleted ${b(g ? g.name : id)}. Site updated.`, md); });

// ================= REVIEWS =================
const REVIEW_FIELDS = [['name', 'Name'], ['country', 'Country'], ['text', 'Text'], ['rating', 'Rating']];
const placeLabel = p => { if (p === 'home') return '🏠 Home'; if (p === 'reviews') return '⭐ Reviews page'; if (p && p.startsWith('guide:')) { const g = C.loadGuides().find(x => x.id === Number(p.slice(6))); return '🧭 ' + (g ? g.name : p); } if (p && p.startsWith('tour:')) return '🏔 ' + p.slice(5); return p; };
function placementKb(prefix) {
  const kb = new InlineKeyboard();
  kb.text('🏠 Home', `${prefix}:home`).text('⭐ Reviews page', `${prefix}:reviews`).row();
  C.loadGuides().forEach(g => kb.text('About: ' + g.name, `${prefix}:guide:${g.id}`).row());
  kb.text('🏔 A specific tour (by slug)', `${prefix}:tour`);
  return kb;
}
function reviewListKb() {
  const rs = C.loadReviews(); const kb = new InlineKeyboard();
  rs.slice(0, 40).forEach(r => kb.text(`${r.name} · ${placeLabel(r.placement)}`.slice(0, 45), `r:v:${r.id}`).row());
  kb.text('➕ New review', 'r:add');
  return { text: `⭐ <b>${rs.length} reviews</b> — tap one:`, kb };
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
  sessions.set(ctx.from.id, { mode: 'editfield', kind: 'review', id, field });
  await ctx.reply(`Send the new ${b((REVIEW_FIELDS.find(f => f[0] === field) || [, field])[1])}${field === 'rating' ? ' (1–5)' : ''}:`, md);
});
bot.callbackQuery(/^r:place:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Where should this review show?', { reply_markup: placementKb(`rsp:${id}`) }); });
bot.callbackQuery(/^rsp:(\d+):(.+)$/, async ctx => {
  const id = Number(ctx.match[1]); let val = ctx.match[2]; await ctx.answerCallbackQuery();
  if (val === 'tour') { sessions.set(ctx.from.id, { mode: 'reviewslug', id }); return ctx.reply('Send the <b>tour slug</b> (the part after slug= in the tour URL, e.g. <code>best-of-kyrgyzstan-10-days</code>):', md); }
  const rs = C.loadReviews(); const r = rs.find(x => x.id === id); if (r) { r.placement = val; C.saveReviews(rs); }
  await ctx.reply(`✅ Now shown on ${esc(placeLabel(val))}. Site updated.`, md);
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
  if (val === 'tour') { s.step = 'tourslug'; return ctx.reply('Send the <b>tour slug</b> (e.g. <code>best-of-kyrgyzstan-10-days</code>):', md); }
  s.draft.placement = val; s.step = 'photo';
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
    kb.text(`${i === 0 ? '⭐' : '🖼'} ${i + 1}`, 'h:noop').text('⭐ first', `h:igmain:${i}`).text('🗑', `h:igdel:${i}`).row();
  });
  kb.text('➕ Add photo', 'h:igadd').row();
  kb.text('✏️ Instagram link', 'h:igurl').text('« Back', 'h:home').row();
  const text = `📸 <b>Instagram grid</b> — ${photos.length} photo(s)\n🔗 Link: ${ig.url ? esc(ig.url) : '<i>(not set)</i>'}\n\n⭐ = shown first. Add with ➕. These photos appear in the “Follow the journey” block on the homepage.`;
  return { text, kb };
}
bot.command('home', ctx => ctx.reply('🏠 <b>Homepage photos</b>\n\nManage the images shown on the front page.', { ...md, reply_markup: homeKb() }));
bot.callbackQuery('h:home', async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('🏠 <b>Homepage photos</b>', { ...md, reply_markup: homeKb() }); });
bot.callbackQuery('h:noop', ctx => ctx.answerCallbackQuery());
bot.callbackQuery('h:ig', async ctx => { await ctx.answerCallbackQuery(); const v = igView(); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery('h:igadd', async ctx => { sessions.set(ctx.from.id, { mode: 'sitephoto', target: 'instagram' }); await ctx.answerCallbackQuery(); await ctx.reply('📷 Send the photo(s) for the Instagram grid. /home when done.'); });
bot.callbackQuery('h:igurl', async ctx => { sessions.set(ctx.from.id, { mode: 'editfield', kind: 'site', field: 'instagram.url' }); await ctx.answerCallbackQuery(); await ctx.reply('🔗 Send your Instagram link (e.g. <code>https://www.instagram.com/azattourskg/</code>):', md); });
bot.callbackQuery(/^h:igdel:(\d+)$/, async ctx => {
  const idx = Number(ctx.match[1]); await ctx.answerCallbackQuery();
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
  await ctx.answerCallbackQuery(); await ctx.reply(`📷 Send the new photo for ${b(EXP_SLOTS[i] || ('card ' + (i + 1)))}.`, md);
});
bot.callbackQuery('h:heroset', async ctx => { sessions.set(ctx.from.id, { mode: 'sitephoto', target: 'hero' }); await ctx.answerCallbackQuery(); await ctx.reply('📷 Send the new <b>hero</b> (top banner) photo. Wide/landscape works best.', md); });
bot.callbackQuery('h:builder', async ctx => { await ctx.answerCallbackQuery(); const v = builderView(); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^h:builderset:(\d+)$/, async ctx => { const i = Number(ctx.match[1]); sessions.set(ctx.from.id, { mode: 'sitephoto', target: 'builder', idx: i }); await ctx.answerCallbackQuery(); await ctx.reply(`📷 Send builder photo <b>${i + 1}</b>.`, md); });

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
  const text = `📍 <b>Sights</b> — ${keys.length} place(s) shown in the “Sights visited on this tour” section of every tour.\n\n✅ = your photo · 🌐 = placeholder · ▫️ = no photo (a tour photo is used).\nTap a place to change its photo or description.`;
  return { text, kb };
}
function sightView(key) {
  const s = (C.loadSights())[key];
  if (!s) return null;
  const kb = new InlineKeyboard()
    .text('📷 Replace photo', `sg:ph:${key}`).row()
    .text('✏️ Edit description', `sg:bl:${key}`).row()
    .text('« All sights', 'sg:list').row();
  const photoLine = s.photo
    ? (String(s.photo).startsWith('images/') ? `🖼 Your photo is set` : '🌐 Placeholder photo (replace it with your own)')
    : '▫️ No photo yet — a tour photo is shown as a fallback';
  const text = `📍 ${b(s.name || key)}\n\n${photoLine}\n📝 ${s.blurb ? esc(s.blurb) : '<i>(no description)</i>'}`;
  return { text, kb };
}
bot.command('sights', ctx => { const { text, kb } = sightsListKb(); ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery('sg:list', async ctx => { await ctx.answerCallbackQuery(); const { text, kb } = sightsListKb(); await ctx.reply(text, { ...md, reply_markup: kb }); });
bot.callbackQuery(/^sg:v:(.+)$/, async ctx => { await ctx.answerCallbackQuery(); const v = sightView(ctx.match[1]); if (!v) return ctx.reply('Not found.'); await ctx.reply(v.text, { ...md, reply_markup: v.kb }); });
bot.callbackQuery(/^sg:ph:(.+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'sightphoto', key: ctx.match[1] }); await ctx.answerCallbackQuery(); await ctx.reply('📷 Send the new photo for this place. /cancel to stop.'); });
bot.callbackQuery(/^sg:bl:(.+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'sightblurb', key: ctx.match[1] }); await ctx.answerCallbackQuery(); await ctx.reply('✏️ Send a short one-line description for this place. /cancel to stop.'); });

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
  { command: 'leads', description: 'Recent enquiries' },
  { command: 'chats', description: 'Website chats' },
  { command: 'help', description: 'Help' },
  { command: 'cancel', description: 'Cancel current action' },
];
bot.start({
  drop_pending_updates: true, // skip backlog so /start answers instantly after a restart
  onStart: async info => {
    try { await bot.api.setMyCommands(BOT_COMMANDS); } catch (e) { console.error('setMyCommands failed:', e.message); }
    console.log(`✅ Azat Tours admin bot running as @${info.username}. Owner: ${OWNER_ID || '(unclaimed)'}`);
  }
});
