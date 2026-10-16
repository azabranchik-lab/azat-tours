// Admin bot: rental cars (/cars, /addcar and the 🚗 Cars menu button).
//
// Lives in its own file so it can be tested with a fake Telegram API (bot.js starts
// polling as soon as it is loaded). bot.js calls registerCars() BEFORE its own
// message:text / message:photo routers and lets those routers hand car sessions to
// onText / onPhoto / onDone below.
//
// Data: content/cars.json via lib/content.js. A new car starts as a draft and goes
// live only from Publish (here or in 📝 Drafts), and only when carMissing() is empty.

const OPTIONS = {
  type: ['SUV', 'Sedan', 'Minivan', 'Van', 'Pickup'],
  transmission: ['Automatic', 'Manual'],
  drive: ['4x4', '2WD'],
  fuel: ['Petrol', 'Diesel', 'Hybrid', 'Gas', 'Electric'],
  seats: ['4', '5', '7', '8+']
};
const FIELDS = [
  ['name', 'Make, model, year'], ['type', 'Type'], ['transmission', 'Gearbox'], ['drive', 'Drive'],
  ['fuel', 'Fuel'], ['seats', 'Seats'], ['priceSelf', 'Self-drive $/day'], ['priceDriver', 'With driver $/day'],
  ['deposit', 'Deposit $'], ['minDays', 'Min. days'], ['features', 'Features'], ['summary', 'Description'],
  ['terms', 'Rental terms']
];
const NUMBER_FIELDS = ['priceSelf', 'priceDriver', 'deposit', 'minDays'];
// /addcar asks these in order; everything else is added later from ✏️ Edit.
const WIZARD = ['name', 'type', 'transmission', 'drive', 'fuel', 'seats', 'priceSelf', 'priceDriver', 'summary', 'photos'];
const QUESTIONS = {
  name: '🆕 <b>New car</b>\n\nSend <b>make, model and year</b> in one line, e.g. <code>Toyota Land Cruiser Prado 2019</code>',
  type: 'Body <b>type</b>?',
  transmission: '<b>Gearbox</b>?',
  drive: '<b>Drive</b>?',
  fuel: '<b>Fuel</b>?',
  seats: 'How many <b>seats</b>?',
  priceSelf: '💵 Price per day <b>self-drive</b>, in USD (just the number). Send <code>0</code> if you only rent it with a driver.',
  priceDriver: '💵 Price per day <b>with a driver</b>, in USD. Send <code>0</code> if you only rent it without a driver.',
  summary: 'Short <b>description</b> for the website, 1–2 sentences in English. Or send <code>skip</code>.',
  photos: '📷 Send <b>photos</b> now (the first one is the cover; an album is fine), then /done.'
};

const label = f => (FIELDS.find(x => x[0] === f) || [, f])[1];
const seatsText = n => (n >= 8 ? '8+' : String(n || ''));
const seatsValue = v => Number(String(v).replace('+', '')) || 0;
// "45", "$45", "45 usd" -> 45; anything without a digit -> null
const toNumber = t => { const s = String(t || ''); if (!/\d/.test(s)) return null; const v = Number(s.replace(/[^\d.]/g, '')); return Number.isFinite(v) ? Math.round(v) : null; };
const icon = c => (c.status === 'draft' ? '📝 ' : c.status === 'hidden' ? '🚫 ' : '') + (c.available === false ? '🔴 ' : '');
const priceShort = c => (c.priceSelf > 0 ? ` · $${c.priceSelf}/d` : c.priceDriver > 0 ? ` · $${c.priceDriver}/d w/ driver` : '');

module.exports = function registerCars(bot, h) {
  const { C, sessions, md, esc, b, ask, cancelKb, sendAlbum, delFile, downloadPhoto, InlineKeyboard } = h;
  const find = id => C.loadCars().find(x => x.id === id);
  const reply = (ctx, v) => (v ? ctx.reply(v.text, { ...md, reply_markup: v.kb }) : ctx.reply('Car not found.'));

  // ---------- views ----------
  function listView() {
    const cars = C.loadCars();
    const kb = new InlineKeyboard();
    cars.slice(0, 40).forEach(c => kb.text(`${icon(c)}${c.name || 'untitled'}${priceShort(c)}`.slice(0, 55), `c:v:${c.id}`).row());
    if (cars.length) kb.text('🔎 Search', 'xsearch:car').row();
    kb.text('➕ Add a car', 'c:add');
    const more = cars.length > 40 ? ' (showing 40, use 🔎 for the rest)' : '';
    return { text: cars.length ? `🚗 <b>${cars.length} car(s)</b>${more}. Tap one:` : '🚗 No cars yet. Tap ➕ to add the first one.', kb };
  }

  function details(c) {
    const specs = [c.type, c.transmission, c.drive, c.fuel, c.seats ? seatsText(c.seats) + ' seats' : ''].filter(Boolean).join(' · ');
    const prices = [
      c.priceSelf > 0 ? `self-drive $${c.priceSelf}/day` : '',
      c.priceDriver > 0 ? `with driver $${c.priceDriver}/day` : ''
    ].filter(Boolean).join(' · ');
    const extra = [c.deposit > 0 ? `deposit $${c.deposit}` : '', c.minDays > 0 ? `min ${c.minDays} day(s)` : ''].filter(Boolean).join(' · ');
    return [
      specs ? '⚙️ ' + esc(specs) : '⚙️ <i>specs missing</i>',
      prices ? '💵 ' + esc(prices) : '💵 <i>no price yet</i>',
      extra ? '📄 ' + esc(extra) : '',
      (c.features || []).length ? '✨ ' + esc(c.features.join(', ')) : ''
    ].filter(Boolean).join('\n');
  }

  function carView(id) {
    const c = find(id);
    if (!c) return null;
    const where = c.status === 'draft' ? '📝 Draft, not on the website yet' : c.status === 'hidden' ? '🚫 Hidden from the website' : '🌐 On the website';
    const text = `🚗 ${b(c.name || 'untitled')}\n${details(c)}\n\n${where}\n${c.available === false ? '🔴 Booked' : '🟢 Available'} · 📷 ${(c.images || []).length} photo(s)` +
      (c.summary ? `\n\n${esc(c.summary.slice(0, 400))}` : '');
    const kb = new InlineKeyboard()
      .text('✏️ Edit', `c:e:${id}`).text('🖼 Photos', `c:ph:${id}`).row()
      .text(c.available === false ? '🟢 Mark available' : '🔴 Mark booked', `c:av:${id}`).row();
    if (c.status === 'published') kb.text('🚫 Hide from website', `c:hide:${id}`).row();
    else kb.text(c.status === 'hidden' ? '🌐 Show on website' : '✅ Publish', `c:pub:${id}`).row();
    kb.text('🗑 Delete', `c:del:${id}`).text('« Cars', 'c:list');
    return { text, kb };
  }

  function editKb(id) {
    const kb = new InlineKeyboard();
    FIELDS.forEach(([f, l], i) => { kb.text(l, `c:ef:${id}:${f}`); if (i % 2 && i < FIELDS.length - 1) kb.row(); });
    return kb.row().text('« Back', `c:v:${id}`);
  }

  function photosView(id) {
    const c = find(id);
    if (!c) return null;
    const imgs = c.images || [];
    const kb = new InlineKeyboard();
    imgs.forEach((img, i) => {
      kb.text(`${i === 0 ? '⭐' : '🖼'} ${i + 1}`, 'c:noop')
        .text('⭐', `c:phmain:${id}:${i}`).text('🔼', `c:phup:${id}:${i}`).text('🔽', `c:phdn:${id}:${i}`).text('🗑', `c:phdel:${id}:${i}`).row();
    });
    if (imgs.length) kb.text('🔄 Show photos', `c:phshow:${id}`).row();
    kb.text('➕ Add photos', `c:phadd:${id}`).row().text('« Back', `c:v:${id}`);
    return { text: `🖼 ${b(c.name)}: ${imgs.length} photo(s)\n⭐ = cover (first) · 🔼🔽 reorder · 🗑 delete · ➕ add.`, kb };
  }

  // Picker buttons; prefix decides who handles the tap (wizard or edit).
  function pickerKb(field, prefix) {
    const kb = new InlineKeyboard();
    OPTIONS[field].forEach((o, i, all) => { kb.text(o, `${prefix}:${field}:${i}`); if (i % 2 && i < all.length - 1) kb.row(); });
    return kb.row().text('✖️ Cancel', 'x:cancel');
  }
  const pickValue = (field, i) => (field === 'seats' ? seatsValue(OPTIONS.seats[i]) : OPTIONS[field][i]);

  // ---------- publishing (used here and by 📝 Drafts in bot.js) ----------
  function publish(id) {
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (!c) return { ok: false, missing: ['the car (not found)'] };
    const missing = C.carMissing(c);
    if (missing.length) return { ok: false, missing, car: c };
    c.status = 'published'; C.saveCars(cars);
    return { ok: true, car: c };
  }
  function discard(id) {
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (!c) return null;
    (c.images || []).forEach(im => { if (String(im).startsWith('images/')) delFile(im); });
    C.saveCars(cars.filter(x => x.id !== id));
    return c;
  }
  const missingText = m => `⚠️ Not ready to publish yet. Still missing: ${esc(m.join(', '))}.`;

  function draftView(id) {
    const c = find(id);
    if (!c || c.status !== 'draft') return null;
    const kb = new InlineKeyboard()
      .text('✅ Publish', `dr:pub:c:${id}`).text('✏️ Edit', `c:v:${id}`).row()
      .text('🗑 Discard', `dr:disc:c:${id}`).text('« Drafts', 'dr:list');
    return { text: `🚗 <b>DRAFT</b>: ${b(c.name || 'untitled')}\n${details(c)}\n📷 ${(c.images || []).length} photo(s)`, kb };
  }

  // ---------- wizard ----------
  function askStep(ctx, step) {
    if (OPTIONS[step]) return ctx.reply(QUESTIONS[step], { ...md, reply_markup: pickerKb(step, 'cw') });
    return ask(ctx, QUESTIONS[step]);
  }
  const nextStep = step => WIZARD[WIZARD.indexOf(step) + 1];

  async function saveDraft(ctx, s) {
    const cars = C.loadCars(); const d = s.draft;
    d.id = C.nextCarId(cars);
    if (!d.slug) d.slug = C.uniqueSlug(d.name, cars);
    d.status = 'draft';
    cars.unshift(d); C.saveCars(cars); sessions.delete(ctx.from.id);
    const missing = C.carMissing(d);
    await ctx.reply(`📝 <b>Saved as a draft.</b> "${esc(d.name)}" is NOT on the website yet.` +
      (missing.length ? `\nBefore publishing, add: ${esc(missing.join(', '))}.` : '\nTap ✅ Publish when it looks right.'), md);
    return reply(ctx, carView(d.id));
  }

  // ---------- commands & buttons ----------
  const startWizard = ctx => { sessions.set(ctx.from.id, { mode: 'addcar', step: 'name', draft: C.blankCar() }); return askStep(ctx, 'name'); };
  bot.command('cars', ctx => reply(ctx, listView()));
  bot.command('addcar', startWizard);
  bot.callbackQuery('c:list', async ctx => { await ctx.answerCallbackQuery(); await reply(ctx, listView()); });
  bot.callbackQuery('c:add', async ctx => { await ctx.answerCallbackQuery(); await startWizard(ctx); });
  bot.callbackQuery('c:noop', ctx => ctx.answerCallbackQuery());
  bot.callbackQuery(/^c:v:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); await reply(ctx, carView(Number(ctx.match[1]))); });

  // wizard picker taps
  bot.callbackQuery(/^cw:(\w+):(\d+)$/, async ctx => {
    const s = sessions.get(ctx.from.id), field = ctx.match[1], i = Number(ctx.match[2]);
    if (!s || s.mode !== 'addcar' || s.step !== field || !OPTIONS[field] || !OPTIONS[field][i]) return ctx.answerCallbackQuery({ text: 'This button is no longer active.' });
    await ctx.answerCallbackQuery();
    s.draft[field] = pickValue(field, i);
    try { await ctx.editMessageText(`${QUESTIONS[field]} → <b>${esc(OPTIONS[field][i])}</b>`, md); } catch (e) { /* old message */ }
    s.step = nextStep(field);
    await askStep(ctx, s.step);
  });

  // availability, publish, hide
  bot.callbackQuery(/^c:av:(\d+)$/, async ctx => {
    const id = Number(ctx.match[1]);
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (!c) return ctx.answerCallbackQuery({ text: 'Car not found.' });
    c.available = c.available === false; C.saveCars(cars);
    await ctx.answerCallbackQuery({ text: c.available ? 'Marked available 🟢' : 'Marked booked 🔴' });
    const v = carView(id);
    try { await ctx.editMessageText(v.text, { ...md, reply_markup: v.kb }); } catch (e) { await reply(ctx, v); }
  });
  bot.callbackQuery(/^c:pub:(\d+)$/, async ctx => {
    const id = Number(ctx.match[1]); const r = publish(id);
    await ctx.answerCallbackQuery(r.ok ? { text: 'Published ✅' } : {});
    if (!r.ok) return ctx.reply(missingText(r.missing), md);
    await ctx.reply(`🎉 ${b(r.car.name)} is on the website now.`, md);
    await reply(ctx, carView(id));
  });
  bot.callbackQuery(/^c:hide:(\d+)$/, async ctx => {
    const id = Number(ctx.match[1]);
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (c) { c.status = 'hidden'; C.saveCars(cars); }
    await ctx.answerCallbackQuery({ text: 'Hidden' });
    await reply(ctx, carView(id));
  });

  // edit fields
  bot.callbackQuery(/^c:e:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); await ctx.reply('Which field to edit?', { reply_markup: editKb(Number(ctx.match[1])) }); });
  bot.callbackQuery(/^c:ef:(\d+):(\w+)$/, async ctx => {
    const id = Number(ctx.match[1]), field = ctx.match[2];
    await ctx.answerCallbackQuery();
    const c = find(id);
    if (!c || !FIELDS.some(f => f[0] === field)) return ctx.reply('Car not found.');
    if (OPTIONS[field]) return ctx.reply(`${b(c.name)}: pick the ${esc(label(field).toLowerCase())}:`, { ...md, reply_markup: pickerKb(field, `c:set:${id}`) });
    sessions.set(ctx.from.id, { mode: 'editfield', kind: 'car', id, field });
    const now = field === 'features' ? (c.features || []).join(', ') : c[field];
    const hint = field === 'features' ? ' (comma-separated, e.g. <code>Air conditioning, Roof rack</code>)'
      : NUMBER_FIELDS.includes(field) ? ' (a number, <code>0</code> = none)'
      : field === 'name' ? ' (e.g. <code>Toyota Land Cruiser Prado 2019</code>)'
      : ' (or <code>-</code> to clear)';
    await ask(ctx, `✏️ ${b(c.name)} → send the new ${b(label(field))}${hint}:` + (now ? `\n\nNow: ${esc(String(now).slice(0, 500))}` : ''));
  });
  bot.callbackQuery(/^c:set:(\d+):(\w+):(\d+)$/, async ctx => {
    const id = Number(ctx.match[1]), field = ctx.match[2], i = Number(ctx.match[3]);
    if (!OPTIONS[field] || !OPTIONS[field][i]) return ctx.answerCallbackQuery({ text: 'This button is no longer active.' });
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (!c) return ctx.answerCallbackQuery({ text: 'Car not found.' });
    c[field] = pickValue(field, i); C.saveCars(cars);
    await ctx.answerCallbackQuery({ text: 'Saved ✅' });
    await reply(ctx, carView(id));
  });

  // photos
  bot.callbackQuery(/^c:ph:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const id = Number(ctx.match[1]); const c = find(id); if (c) await sendAlbum(ctx, c.images); await reply(ctx, photosView(id)); });
  bot.callbackQuery(/^c:phshow:(\d+)$/, async ctx => { await ctx.answerCallbackQuery(); const c = find(Number(ctx.match[1])); if (c) await sendAlbum(ctx, c.images); });
  const movePhoto = (id, from, to) => {
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (!c || !c.images || !c.images[from] || !c.images[to]) return;
    [c.images[from], c.images[to]] = [c.images[to], c.images[from]]; C.saveCars(cars);
  };
  bot.callbackQuery(/^c:phup:(\d+):(\d+)$/, async ctx => { const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery(); if (i > 0) movePhoto(id, i, i - 1); await reply(ctx, photosView(id)); });
  bot.callbackQuery(/^c:phdn:(\d+):(\d+)$/, async ctx => { const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery(); movePhoto(id, i, i + 1); await reply(ctx, photosView(id)); });
  bot.callbackQuery(/^c:phmain:(\d+):(\d+)$/, async ctx => {
    const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery();
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (c && c.images && c.images[i]) { const [img] = c.images.splice(i, 1); c.images.unshift(img); C.saveCars(cars); }
    const v = photosView(id); if (v) await ctx.reply('⭐ Cover set.\n\n' + v.text, { ...md, reply_markup: v.kb });
  });
  bot.callbackQuery(/^c:phadd:(\d+)$/, async ctx => { sessions.set(ctx.from.id, { mode: 'addphotos', kind: 'car', id: Number(ctx.match[1]) }); await ctx.answerCallbackQuery(); await ask(ctx, '📷 Send photos now, then /done.'); });
  bot.callbackQuery(/^c:phdel:(\d+):(\d+)$/, async ctx => {
    const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery();
    await ctx.reply(`Delete photo ${i + 1}? This can't be undone.`, { reply_markup: new InlineKeyboard().text('🗑 Yes, delete', `c:phdelyes:${id}:${i}`).text('« Keep', `c:ph:${id}`) });
  });
  bot.callbackQuery(/^c:phdelyes:(\d+):(\d+)$/, async ctx => {
    const id = Number(ctx.match[1]), i = Number(ctx.match[2]); await ctx.answerCallbackQuery({ text: 'Deleted' });
    const cars = C.loadCars(); const c = cars.find(x => x.id === id);
    if (c && c.images && c.images[i]) { if (String(c.images[i]).startsWith('images/')) delFile(c.images[i]); c.images.splice(i, 1); C.saveCars(cars); }
    const v = photosView(id); if (v) await ctx.reply('🗑 Removed.\n\n' + v.text, { ...md, reply_markup: v.kb });
  });

  // delete the whole car
  bot.callbackQuery(/^c:del:(\d+)$/, async ctx => { const id = Number(ctx.match[1]); await ctx.answerCallbackQuery(); await ctx.reply('Delete this car and its photos for good?', { reply_markup: new InlineKeyboard().text('🗑 Yes, delete', `c:delyes:${id}`).text('« Keep', `c:v:${id}`) }); });
  bot.callbackQuery(/^c:delyes:(\d+)$/, async ctx => {
    await ctx.answerCallbackQuery({ text: 'Deleted' });
    const c = discard(Number(ctx.match[1]));
    await ctx.reply(`🗑 Deleted ${b(c ? c.name : 'the car')}.`, md);
    await reply(ctx, listView());
  });

  // ---------- hooks for bot.js routers ----------
  // Return true when the message belonged to a car session.
  async function onText(ctx, s) {
    const txt = ctx.message.text, val = txt.trim();
    if (s.mode === 'editfield' && s.kind === 'car') {
      const cars = C.loadCars(); const c = cars.find(x => x.id === s.id);
      if (!c) { sessions.delete(ctx.from.id); await ctx.reply('⚠️ That car no longer exists.'); return true; }
      if (s.field === 'name') {
        const p = C.parseCarName(val);
        if (!p) { await ask(ctx, '⚠️ I need make, model and year, e.g. <code>Toyota Land Cruiser Prado 2019</code>. Send it again:'); return true; }
        Object.assign(c, p);
      } else if (NUMBER_FIELDS.includes(s.field)) {
        const n = toNumber(val);
        if (n === null) { await ask(ctx, '⚠️ Send just a number, e.g. <code>45</code>:'); return true; }
        const self = s.field === 'priceSelf' ? n : c.priceSelf, drv = s.field === 'priceDriver' ? n : c.priceDriver;
        if (c.status !== 'draft' && !(self > 0) && !(drv > 0)) { await ask(ctx, '⚠️ A car on the website needs at least one price. Send a number above 0:'); return true; }
        c[s.field] = n;
      } else if (s.field === 'features') {
        c.features = val === '-' ? [] : txt.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
      } else {
        if (val.length > 4000) { await ask(ctx, '⚠️ That\'s too long (max 4000 characters). Send a shorter version:'); return true; }
        c[s.field] = val === '-' ? '' : val;
      }
      C.saveCars(cars); sessions.delete(ctx.from.id);
      await ctx.reply('✅ Saved.');
      await reply(ctx, carView(c.id));
      return true;
    }
    if (s.mode !== 'addcar') return false;
    const d = s.draft;
    if (s.step === 'name') {
      const p = C.parseCarName(val);
      if (!p) { await ask(ctx, '⚠️ I need make, model and year in one line, e.g. <code>Toyota Land Cruiser Prado 2019</code>. Send it again:'); return true; }
      Object.assign(d, p);
    } else if (s.step === 'priceSelf' || s.step === 'priceDriver') {
      const n = toNumber(val);
      if (n === null) { await ask(ctx, '⚠️ Send just a number, e.g. <code>45</code> (or <code>0</code>):'); return true; }
      if (s.step === 'priceDriver' && !(n > 0) && !(d.priceSelf > 0)) { await ask(ctx, '⚠️ Both prices can\'t be 0. Send the price per day with a driver:'); return true; }
      d[s.step] = n;
    } else if (s.step === 'summary') {
      d.summary = val.toLowerCase() === 'skip' ? '' : val.slice(0, 4000);
    } else if (OPTIONS[s.step]) {
      await askStep(ctx, s.step); // typed instead of tapping: show the buttons again
      return true;
    } else {
      await ctx.reply('📷 Send photos, or /done to finish.');
      return true;
    }
    s.step = nextStep(s.step);
    await askStep(ctx, s.step);
    return true;
  }

  async function onPhoto(ctx, s, fileId, n) {
    if (s.mode === 'addphotos' && s.kind === 'car') {
      const slug = (find(s.id) || {}).slug || 'car';
      const rel = await downloadPhoto(ctx, fileId, 'car', slug, n);
      // load -> mutate -> save with no await in between (see bot.js photo routing)
      const cars = C.loadCars(); const c = cars.find(x => x.id === s.id);
      if (!c) { delFile(rel); sessions.delete(ctx.from.id); await ctx.reply('⚠️ That car no longer exists.'); return true; }
      c.images = c.images || []; c.images.push(rel); C.saveCars(cars);
      await ctx.reply(`✅ Photo added (${c.images.length}). Another, or /done.`);
      return true;
    }
    if (s.mode === 'addcar' && s.step === 'photos') {
      if (!s.draft.slug) s.draft.slug = C.uniqueSlug(s.draft.name, C.loadCars());
      const rel = await downloadPhoto(ctx, fileId, 'car', s.draft.slug, n);
      s.draft.images.push(rel);
      await ctx.reply(`✅ Photo ${s.draft.images.length} saved. Another, or /done.`);
      return true;
    }
    if (s.mode === 'addcar') { await ctx.reply('Answer the question above first; photos come at the end.'); return true; }
    return false;
  }

  async function onDone(ctx, s) {
    if (s.mode === 'addcar') {
      if (s.step === 'photos') { await saveDraft(ctx, s); return true; }
      await ctx.reply('Answer the question above first, or /cancel.');
      return true;
    }
    if (s.mode === 'addphotos' && s.kind === 'car') {
      sessions.delete(ctx.from.id);
      await reply(ctx, photosView(s.id));
      return true;
    }
    return false;
  }

  return {
    onText, onPhoto, onDone, publish, discard, draftView, missingText,
    drafts: () => C.loadCars().filter(c => c.status === 'draft'),
    search: { items: () => C.loadCars(), match: c => c.name, label: c => c.name, prefix: 'c:v' }
  };
};

module.exports.OPTIONS = OPTIONS;
module.exports.toNumber = toNumber;
