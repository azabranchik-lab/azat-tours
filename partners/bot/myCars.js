// «Мои авто» (SPEC §6.7): paged list, then a per-car menu whose buttons depend
// on the status. Price, free/busy and pause apply at once (no re-moderation);
// «Редактировать» takes a published car off the site until it is approved again.
// State while typing a price: { flow: 'myprice', carId, field }.
const { InlineKeyboard } = require('grammy');
const S = require('./carWizard/steps');
const { carTitle, fieldValue } = require('../lib/format');
const { mainMenu, tidy } = require('./menus');

const PAGE = 8;
const PRICE_FIELDS = { s: 'priceSelfDrive', d: 'priceWithDriver' };
const MODE_OF = { priceSelfDrive: 'SELF_DRIVE', priceWithDriver: 'WITH_DRIVER' };

function ownCar(ctx, id) {
  const car = ctx.cars.get(id);
  return car && car.partnerId === ctx.partner.id && car.status !== 'ARCHIVED' ? car : null;
}

// ----- list -----

function listView(ctx, page) {
  const cars = ctx.cars.listByPartner(ctx.partner.id);
  if (!cars.length) return { text: ctx.t('my_empty'), kb: null };
  const pages = Math.ceil(cars.length / PAGE);
  const p = Math.min(Math.max(0, page), pages - 1);
  const kb = new InlineKeyboard();
  for (const c of cars.slice(p * PAGE, p * PAGE + PAGE)) {
    const busy = c.status === 'APPROVED' && c.availability === 'BUSY' ? ` · ${ctx.t('avail_BUSY')}` : '';
    kb.text(`${carTitle(c, ctx.t)} · ${ctx.t('status_' + c.status)}${busy}`, `my:car:${c.id}`).row();
  }
  if (pages > 1) {
    if (p > 0) kb.text(ctx.t('btn_prev_page'), `my:pg:${p - 1}`);
    kb.text(`${p + 1} / ${pages}`, `my:pg:${p}`);
    if (p < pages - 1) kb.text(ctx.t('btn_next_page'), `my:pg:${p + 1}`);
  }
  return { text: ctx.t('my_title', { n: cars.length }), kb: tidy(kb) };
}

async function showList(ctx, page = 0, edit = false) {
  const v = listView(ctx, page);
  const opts = v.kb ? { reply_markup: v.kb } : { reply_markup: mainMenu(ctx.t) };
  if (edit && v.kb) return ctx.editMessageText(v.text, { reply_markup: v.kb }).catch(() => {});
  return ctx.reply(v.text, opts);
}

// ----- one car -----

function carView(ctx, car) {
  const lines = [ctx.t('my_car', {
    car: carTitle(car, ctx.t), status: ctx.t('status_' + car.status),
    avail: ctx.t('avail_' + car.availability), city: car.city || '-'
  })];
  for (const [field, mode] of Object.entries(MODE_OF)) {
    if (car[field]) lines.push(ctx.t('my_price_line', { mode: ctx.t('enum_' + mode), price: fieldValue(car, field, ctx.t) }));
  }
  const note = { PENDING: 'my_note_PENDING', DRAFT: 'my_note_DRAFT', PAUSED: 'my_note_PAUSED' }[car.status];
  if (car.status === 'REJECTED') lines.push('', ctx.t('my_note_REJECTED', { reason: car.rejectReason || '-' }));
  else if (note) lines.push('', ctx.t(note));

  const kb = new InlineKeyboard();
  const id = car.id;
  const live = car.status === 'APPROVED' || car.status === 'PAUSED';
  if (car.status === 'DRAFT') kb.text(ctx.t('btn_fill'), `my:fill:${id}`).row();
  if (car.status === 'REJECTED') kb.text(ctx.t('btn_fix'), `fix:${id}`).row();
  if (live) {
    kb.text(ctx.t('btn_price'), `my:price:${id}`).text(ctx.t('btn_toggle_busy'), `my:busy:${id}`).row();
    kb.text(ctx.t(car.status === 'APPROVED' ? 'btn_pause' : 'btn_resume'), `my:pause:${id}`).text(ctx.t('btn_edit_car'), `my:edit:${id}`).row();
  }
  if (car.status !== 'DRAFT') kb.text(ctx.t('btn_copy'), `my:copy:${id}`);
  kb.text(ctx.t('btn_delete'), `my:del:${id}`).row();
  kb.text(ctx.t('btn_to_list'), 'my:pg:0');
  return { text: lines.join('\n'), kb: tidy(kb) };
}

async function showCar(ctx, car, edit = true) {
  const v = carView(ctx, car);
  if (edit) return ctx.editMessageText(v.text, { reply_markup: v.kb }).catch(() => ctx.reply(v.text, { reply_markup: v.kb }));
  return ctx.reply(v.text, { reply_markup: v.kb });
}

// Site data only changes for cars that are (or just were) public.
async function siteChanged(ctx, before, after) {
  if (before === 'APPROVED' || after === 'APPROVED') await ctx.onCarsChanged();
}

async function onCallback(ctx, parts) {
  const [, action, id, arg] = parts;
  if (action === 'pg') { await ctx.answerCallbackQuery(); return showList(ctx, Number(id) || 0, true); }

  const car = ownCar(ctx, id);
  if (!car) return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
  const live = car.status === 'APPROVED' || car.status === 'PAUSED';

  if (action === 'car') { await ctx.answerCallbackQuery(); return showCar(ctx, car); }

  if (action === 'fill' && car.status === 'DRAFT') {
    await ctx.answerCallbackQuery();
    const key = S.resumeStep(car);
    if (key === 'summary') return require('./carWizard/summary').show(ctx, car, { withPhotos: true });
    const mode = car.copiedFromId && S.COPY_STEPS.includes(key) ? 'copy' : 'full';
    return require('./carWizard/handlers').ask(ctx, car, key, mode);
  }

  if (action === 'busy' && live) {
    const availability = car.availability === 'BUSY' ? 'AVAILABLE' : 'BUSY';
    const updated = ctx.cars.update(id, { availability });
    await siteChanged(ctx, car.status, updated.status);
    await ctx.answerCallbackQuery({ text: ctx.t('busy_now', { avail: ctx.t('avail_' + availability) }) });
    return showCar(ctx, updated);
  }

  if (action === 'pause' && live) {
    const status = car.status === 'APPROVED' ? 'PAUSED' : 'APPROVED';
    const updated = ctx.cars.update(id, { status });
    await siteChanged(ctx, car.status, status);
    await ctx.answerCallbackQuery({ text: ctx.t(status === 'PAUSED' ? 'paused_now' : 'resumed_now') });
    return showCar(ctx, updated);
  }

  if (action === 'price' && live) {
    const fields = Object.keys(MODE_OF).filter(f => S.applies(S.step(f), car));
    if (fields.length === 1) { await ctx.answerCallbackQuery(); return askPrice(ctx, car, fields[0]); }
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    for (const [code, f] of Object.entries(PRICE_FIELDS)) if (fields.includes(f)) kb.text(ctx.t('enum_' + MODE_OF[f]), `my:pr:${id}:${code}`);
    return ctx.reply(ctx.t('price_pick'), { reply_markup: kb.row().text(ctx.t('btn_back'), `my:car:${id}`) });
  }
  if (action === 'pr' && live && PRICE_FIELDS[arg]) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
    return askPrice(ctx, car, PRICE_FIELDS[arg]);
  }

  if (action === 'edit' && live) {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text(ctx.t('btn_edit_go'), `my:editgo:${id}`).text(ctx.t('btn_back'), `my:car:${id}`);
    return ctx.editMessageText(ctx.t('edit_requires_review'), { reply_markup: kb }).catch(() => {});
  }
  if (action === 'editgo' && live) {
    await ctx.answerCallbackQuery();
    // Off the site right away, so unreviewed changes can never be published by a rebuild.
    const updated = ctx.cars.update(id, { status: 'DRAFT', en: null, rejectReason: null });
    await siteChanged(ctx, car.status, 'DRAFT');
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
    return require('./carWizard/summary').show(ctx, updated, { withPhotos: true });
  }

  if (action === 'copy' && car.status !== 'DRAFT') {
    await ctx.answerCallbackQuery();
    return require('./carWizard/handlers').onAddCallback(ctx, 'copy', id);
  }

  if (action === 'del') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text(ctx.t('btn_yes_delete'), `my:delok:${id}`).text(ctx.t('btn_back'), `my:car:${id}`);
    return ctx.editMessageText(ctx.t('confirm_delete', { car: carTitle(car, ctx.t) }), { reply_markup: kb }).catch(() => {});
  }
  if (action === 'delok') {
    await ctx.answerCallbackQuery();
    await removeCar(ctx, car);
    await ctx.editMessageText(ctx.t('car_deleted')).catch(() => {});
    return showList(ctx, 0);
  }
  return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
}

// Never-published drafts disappear with their photos; anything that was ever
// submitted or published is archived (soft delete, photos cleaned up after 30 days).
async function removeCar(ctx, car) {
  const st = ctx.partner.state;
  if (st && st.carId === car.id) ctx.setState(null);
  if (car.status === 'DRAFT' && !car.approvedAt && !car.submittedAt) {
    await ctx.storage.deleteDir(car.id);
    ctx.cars.remove(car.id);
    return;
  }
  ctx.cars.update(car.id, { status: 'ARCHIVED' });
  await siteChanged(ctx, car.status, 'ARCHIVED');
}

// ----- price -----

async function askPrice(ctx, car, field) {
  ctx.setState({ flow: 'myprice', carId: car.id, field });
  return ctx.reply(ctx.t('price_ask', { mode: ctx.t('enum_' + MODE_OF[field]).toLowerCase(), price: fieldValue(car, field, ctx.t) }));
}

async function onText(ctx) {
  const st = ctx.partner.state;
  const car = ownCar(ctx, st.carId);
  if (!car || !MODE_OF[st.field] || !(car.status === 'APPROVED' || car.status === 'PAUSED')) {
    ctx.setState(null);
    return ctx.reply(ctx.t('menu_hint'), { reply_markup: mainMenu(ctx.t) });
  }
  const r = S.parseText(S.step(st.field), ctx.message.text);
  if (!r.ok) return ctx.reply(ctx.t(r.error, r.params));
  const updated = ctx.cars.update(car.id, { [st.field]: r.value });
  ctx.setState(null);
  await siteChanged(ctx, car.status, updated.status);
  await ctx.reply(ctx.t('price_saved'), { reply_markup: mainMenu(ctx.t) });
  return showCar(ctx, updated, false);
}

module.exports = { showList, onCallback, onText, removeCar };
