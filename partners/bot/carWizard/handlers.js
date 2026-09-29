// Add-car wizard (SPEC §6.3): start (resume / copy / new), one question per
// step, answers written straight into the DRAFT car.
// State: { flow: 'car', carId, step, mode: 'full' | 'copy' | 'edit', qmsg }.
const { InlineKeyboard } = require('grammy');
const S = require('./steps');
const { carTitle } = require('../../lib/format');
const { mainMenu, tidy } = require('../menus');

const clearKb = (ctx, msgId) => (msgId
  ? ctx.api.editMessageReplyMarkup(ctx.chat.id, msgId, { reply_markup: { inline_keyboard: [] } }).catch(() => {})
  : Promise.resolve());

// The car must belong to this partner and still be editable: a draft, or a
// rejected car being fixed before it is sent again.
function ownDraft(ctx, id) {
  const car = ctx.cars.get(id);
  return car && car.partnerId === ctx.partner.id && (car.status === 'DRAFT' || car.status === 'REJECTED') ? car : null;
}

function presetLabel(ctx, s, p) { return s.presetsRaw || typeof p === 'number' ? String(p) : ctx.t(p); }

function questionKeyboard(ctx, car, s, mode) {
  const kb = new InlineKeyboard();
  const d = `w:${s.index}`;
  if (s.type === 'enum') {
    // Long labels (the plate question) go one per row; the partner's last plate choice comes first.
    const perRow = s.key === 'plateOnPhotos' ? 1 : 2;
    let order = s.options.map((o, i) => i);
    const last = s.key === 'plateOnPhotos' ? ctx.cars.lastPlateChoice(ctx.partner.id) : null;
    if (last) order = [s.options.indexOf(last), ...order.filter(i => s.options[i] !== last)];
    order.forEach((i, n) => { kb.text(ctx.t('enum_' + s.options[i]), `${d}:o:${i}`); if ((n + 1) % perRow === 0) kb.row(); });
    kb.row();
  } else if (s.type === 'multi') {
    const sel = car[s.key] || [];
    s.options.forEach((o, i) => kb.text(`${sel.includes(o) ? '✓ ' : ''}${ctx.t('enum_' + o)}`, `${d}:t:${i}`).row());
    kb.text(ctx.t('btn_done'), `${d}:d`).row();
  } else if (s.presets) {
    const perRow = s.type === 'int' ? 5 : s.presetsRaw ? 3 : 1;
    s.presets.forEach((p, i) => { kb.text(presetLabel(ctx, s, p), `${d}:p:${i}`); if ((i + 1) % perRow === 0) kb.row(); });
    kb.row();
    if (s.other) kb.text(ctx.t(s.other), `${d}:x`).row();
  }
  if (mode === 'edit' || S.prevStep(car, s.key, mode)) kb.text(ctx.t('btn_back'), `${d}:b`);
  if (!s.required) kb.text(ctx.t('btn_skip'), `${d}:s`);
  kb.text(ctx.t('btn_cancel'), `${d}:c`);
  return tidy(kb);
}

function counter(ctx, car, key, mode) {
  if (mode === 'edit') return '';
  // Before rental modes are chosen, count as self-drive (the common case) so the total barely moves.
  const basis = car.rentalModes && car.rentalModes.length ? car : { ...car, rentalModes: ['SELF_DRIVE'] };
  const seq = S.sequence(mode).filter(k => S.applies(S.step(k), basis));
  const n = seq.indexOf(key) + 1;
  return n > 0 ? ctx.t('step_counter', { n, total: seq.length }) + '\n' : '';
}

function questionText(ctx, car, key, mode) {
  let text = counter(ctx, car, key, mode) + ctx.t('q_' + key);
  if (key === 'plateOnPhotos') {
    const last = ctx.cars.lastPlateChoice(ctx.partner.id);
    if (last) text += '\n\n' + ctx.t('plate_last_time', { choice: ctx.t('enum_' + last) });
  }
  return text;
}

async function ask(ctx, car, key, mode) {
  if (key === 'summary') return require('./summary').show(ctx, car);
  if (key === 'photos') return require('./photos').ask(ctx, car, mode, { intro: true });
  const s = S.step(key);
  await clearKb(ctx, ctx.partner.state && ctx.partner.state.qmsg);
  const msg = await ctx.reply(questionText(ctx, car, key, mode), { reply_markup: questionKeyboard(ctx, car, s, mode) });
  if (car.status === 'DRAFT' && mode !== 'edit') ctx.cars.update(car.id, { draftStep: key });
  ctx.setState({ flow: 'car', carId: car.id, step: key, mode, qmsg: msg.message_id });
}

// Store an answer, then move on.
async function save(ctx, car, key, value, mode) {
  const merged = { ...car, [key]: value };
  const updated = ctx.cars.update(car.id, { [key]: value, ...S.inapplicableFields(merged) });
  let next;
  if (mode === 'edit') next = S.missingRequired(updated)[0] || 'summary'; // an edit can make a field required
  else next = S.nextStep(updated, key, mode);
  return ask(ctx, updated, next, mode);
}

// ----- start: resume / copy / new -----

async function startAdd(ctx) {
  const draft = ctx.cars.latestDraft(ctx.partner.id);
  if (draft) {
    const kb = new InlineKeyboard()
      .text(ctx.t('btn_continue'), `add:cont:${draft.id}`).row()
      .text(ctx.t('btn_restart'), `add:new:${draft.id}`);
    return ctx.reply(ctx.t('draft_found', { car: carTitle(draft, ctx.t) }), { reply_markup: kb });
  }
  return offerCopyOrNew(ctx);
}

async function offerCopyOrNew(ctx) {
  const sources = ctx.cars.copySources(ctx.partner.id, 5);
  if (!sources.length) return createBlank(ctx);
  const kb = new InlineKeyboard().text(ctx.t('btn_new_car'), 'add:blank').row();
  for (const c of sources) kb.text(ctx.t('btn_copy_of', { car: carTitle(c, ctx.t) }), `add:copy:${c.id}`).row();
  return ctx.reply(ctx.t('ask_copy'), { reply_markup: tidy(kb) });
}

async function createBlank(ctx) {
  const car = ctx.cars.create(ctx.partner.id, { city: ctx.partner.city });
  return ask(ctx, car, 'make', 'full');
}

async function onAddCallback(ctx, action, id) {
  const done = () => ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
  if (action === 'blank') { await ctx.answerCallbackQuery(); await done(); return createBlank(ctx); }

  if (action === 'copy') {
    const src = ctx.cars.get(id);
    if (!src || src.partnerId !== ctx.partner.id) return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
    await ctx.answerCallbackQuery(); await done();
    const car = ctx.cars.create(ctx.partner.id, S.copyFields(src));
    await ctx.reply(ctx.t('copy_started', { car: carTitle(src, ctx.t) }));
    return ask(ctx, car, S.COPY_STEPS[0], 'copy');
  }

  const draft = ownDraft(ctx, id);
  if (!draft) return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
  await ctx.answerCallbackQuery(); await done();
  if (action === 'cont') {
    const key = S.resumeStep(draft);
    const mode = draft.copiedFromId && S.COPY_STEPS.includes(key) ? 'copy' : 'full';
    if (key === 'summary') return require('./summary').show(ctx, draft, { withPhotos: true });
    return ask(ctx, draft, key, mode);
  }
  if (action === 'new') {
    await ctx.storage.deleteDir(draft.id);
    ctx.cars.remove(draft.id);
    return offerCopyOrNew(ctx);
  }
}

// ----- answers -----

function current(ctx) {
  const st = ctx.partner.state;
  if (!st || st.flow !== 'car' || st.step === 'summary') return null;
  const car = ownDraft(ctx, st.carId);
  return car ? { st, car, s: S.step(st.step) } : null;
}

async function onText(ctx) {
  const cur = current(ctx);
  if (!cur) return ctx.reply(ctx.t('menu_hint'), { reply_markup: mainMenu(ctx.t) });
  const { st, car, s } = cur;
  const r = S.parseText(s, ctx.message.text);
  if (!r.ok) {
    await ctx.reply(ctx.t(r.error, r.params));
    if (r.error === 'choose_button') return ask(ctx, car, s.key, st.mode); // bring the buttons back down
    return;
  }
  return save(ctx, car, s.key, r.value, st.mode);
}

// callback_data: w:<stepIndex>:<action>[:<optionIndex>]
async function onCallback(ctx, parts) {
  const [, idx, action, arg] = parts;
  const cur = current(ctx);
  const s = S.stepByIndex(Number(idx));
  if (!cur || !s || cur.s.key !== s.key) return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
  const { st, car } = cur;
  const msg = ctx.callbackQuery.message;
  // Freeze the answered question as "Question → answer" so the chat reads like a form.
  const freeze = label => ctx.editMessageText(`${msg.text}\n→ ${label}`, { reply_markup: { inline_keyboard: [] } }).catch(() => {});

  if (action === 'o' && s.type === 'enum' && s.options[arg] !== undefined) {
    const value = s.options[arg];
    await ctx.answerCallbackQuery(); await freeze(ctx.t('enum_' + value));
    ctx.partner.state.qmsg = null;
    return save(ctx, car, s.key, value, st.mode);
  }
  if (action === 'p' && s.presets && s.presets[arg] !== undefined) {
    const p = s.presets[arg];
    const value = s.type === 'int' ? p : presetLabel(ctx, s, p);
    await ctx.answerCallbackQuery(); await freeze(String(value));
    ctx.partner.state.qmsg = null;
    return save(ctx, car, s.key, value, st.mode);
  }
  if (action === 'x' && s.other) {
    await ctx.answerCallbackQuery();
    return ctx.reply(ctx.t(s.other + '_ask'));
  }
  if (action === 't' && s.type === 'multi' && s.options[arg] !== undefined) {
    const o = s.options[arg];
    const sel = car[s.key] || [];
    const next = sel.includes(o) ? sel.filter(x => x !== o) : s.options.filter(x => x === o || sel.includes(x));
    const updated = ctx.cars.update(car.id, { [s.key]: next });
    await ctx.answerCallbackQuery();
    return ctx.editMessageReplyMarkup({ reply_markup: questionKeyboard(ctx, updated, s, st.mode) }).catch(() => {});
  }
  if (action === 'd' && s.type === 'photos') return require('./photos').onDone(ctx, car, st.mode);
  if (action === 'd' && s.type === 'multi') {
    const sel = car[s.key] || [];
    if (s.required && !sel.length) return ctx.answerCallbackQuery({ text: ctx.t('multi_min'), show_alert: true });
    await ctx.answerCallbackQuery();
    await freeze(sel.length ? sel.map(x => ctx.t('enum_' + x)).join(', ') : ctx.t('not_set'));
    ctx.partner.state.qmsg = null;
    return save(ctx, car, s.key, sel, st.mode);
  }
  if (action === 's' && !s.required) {
    await ctx.answerCallbackQuery(); await freeze(ctx.t('not_set'));
    ctx.partner.state.qmsg = null;
    return save(ctx, car, s.key, s.type === 'multi' ? [] : null, st.mode);
  }
  if (action === 'b') {
    await ctx.answerCallbackQuery();
    const prev = st.mode === 'edit' ? 'summary' : S.prevStep(car, s.key, st.mode);
    if (!prev) return;
    return ask(ctx, car, prev, st.mode);
  }
  if (action === 'c') {
    await ctx.answerCallbackQuery();
    if (st.mode === 'edit') return ask(ctx, car, 'summary', st.mode); // cancelling one edit returns to the summary
    await clearKb(ctx, st.qmsg);
    ctx.setState(null);
    return ctx.reply(ctx.t('draft_saved'), { reply_markup: mainMenu(ctx.t) });
  }
  return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
}

module.exports = { startAdd, onAddCallback, onText, onCallback, ask, ownDraft, clearKb };
