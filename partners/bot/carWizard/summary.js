// Summary of a draft (SPEC §6.5): card + «Отправить на проверку» / «Изменить» /
// «Удалить черновик». A REJECTED car is fixed through the same summary.
const { InlineKeyboard } = require('grammy');
const { sendAlbum } = require('../../lib/album');
const P = require('../../lib/photos');
const S = require('./steps');
const { carCard, carTitle } = require('../../lib/format');
const { mainMenu, tidy } = require('../menus');

function summaryKeyboard(ctx, car) {
  return new InlineKeyboard()
    .text(ctx.t('btn_submit'), `sum:send:${car.id}`).row()
    .text(ctx.t('btn_edit'), `sum:edit:${car.id}`).row()
    .text(ctx.t('btn_delete_draft'), `sum:del:${car.id}`);
}

function fieldsKeyboard(ctx, car) {
  const kb = new InlineKeyboard();
  const fields = S.STEPS.filter(s => !S.isCompound(s) && S.applies(s, car));
  fields.forEach((s, i) => {
    kb.text(ctx.t('f_' + s.key), s.type === 'photos' ? `sum:ph:${car.id}` : `sum:f:${car.id}:${S.step(s.key).index}`);
    if (i % 2 === 1) kb.row();
  });
  return tidy(kb.row().text(ctx.t('btn_back'), `sum:show:${car.id}`));
}

// «Фото» in «Изменить»: add more (up to the max), upload all again, pick the cover.
function photosKeyboard(ctx, car) {
  const kb = new InlineKeyboard();
  if (ctx.cars.photos(car.id).length < P.MAX_PHOTOS) kb.text(ctx.t('btn_photos_add'), `sum:pa:${car.id}`).row();
  kb.text(ctx.t('btn_photos_redo'), `sum:px:${car.id}`).row();
  kb.text(ctx.t('btn_cover'), `sum:pc:${car.id}`).row();
  return kb.text(ctx.t('btn_back'), `sum:edit:${car.id}`);
}

// Cover choice: one button per photo, numbered as in the album above the summary.
function coverKeyboard(ctx, car) {
  const kb = new InlineKeyboard();
  ctx.cars.photos(car.id).forEach((p, i) => { kb.text(String(i + 1), `sum:cv:${car.id}:${i}`); if (i % 3 === 2) kb.row(); });
  return tidy(kb.row().text(ctx.t('btn_back'), `sum:ph:${car.id}`));
}

async function show(ctx, car, { withPhotos = false } = {}) {
  const { clearKb } = require('./handlers');
  await clearKb(ctx, ctx.partner.state && ctx.partner.state.qmsg);
  ctx.cars.update(car.id, { draftStep: 'summary' });
  const photos = ctx.cars.photos(car.id);
  if (withPhotos && photos.length) {
    try { await sendAlbum(ctx.api, ctx.chat.id, ctx.storage, photos); } catch (e) { console.error('[partners] summary album failed:', e.message); }
  }
  const msg = await ctx.reply(`${ctx.t('summary_title')}\n\n${carCard(car, ctx.t, photos)}`, { reply_markup: summaryKeyboard(ctx, car) });
  ctx.setState({ flow: 'car', carId: car.id, step: 'summary', mode: 'full', qmsg: msg.message_id });
}

// callback_data: sum:<action>:<carId>[:<stepIndex>]
async function onCallback(ctx, parts) {
  const [, action, id, arg] = parts;
  const { ownDraft, ask } = require('./handlers');
  const car = ownDraft(ctx, id);
  if (!car) return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });

  if (action === 'edit') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageReplyMarkup({ reply_markup: fieldsKeyboard(ctx, car) }).catch(() => {});
  }
  if (action === 'show') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageReplyMarkup({ reply_markup: summaryKeyboard(ctx, car) }).catch(() => {});
  }
  if (action === 'f') {
    const s = S.stepByIndex(Number(arg));
    if (!s || !S.applies(s, car)) return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
    await ctx.answerCallbackQuery();
    return ask(ctx, car, s.key, 'edit');
  }
  if (action === 'ph') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageReplyMarkup({ reply_markup: photosKeyboard(ctx, car) }).catch(() => {});
  }
  if (action === 'pa') {
    await ctx.answerCallbackQuery();
    return require('./photos').ask(ctx, car, 'edit');
  }
  if (action === 'px') {
    await ctx.answerCallbackQuery();
    const photos = require('./photos');
    await photos.clearAll(ctx, car);
    return photos.ask(ctx, car, 'edit');
  }
  if (action === 'pc') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageReplyMarkup({ reply_markup: coverKeyboard(ctx, car) }).catch(() => {});
  }
  if (action === 'cv') {
    const photos = ctx.cars.photos(car.id);
    const chosen = photos[Number(arg)];
    if (!chosen) return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
    await ctx.answerCallbackQuery();
    ctx.cars.setPhotoOrder(car.id, [chosen.id, ...photos.filter(p => p !== chosen).map(p => p.id)]);
    await ctx.reply(ctx.t('cover_saved', { n: Number(arg) + 1 }));
    return show(ctx, ctx.cars.get(car.id), { withPhotos: true });
  }
  if (action === 'del') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text(ctx.t('btn_yes_delete'), `sum:delok:${car.id}`).text(ctx.t('btn_back'), `sum:keep:${car.id}`);
    return ctx.reply(ctx.t('confirm_delete', { car: carTitle(car, ctx.t) }), { reply_markup: kb });
  }
  if (action === 'keep') {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage().catch(() => {});
  }
  if (action === 'delok') {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
    const st = ctx.partner.state;
    if (st && st.carId === car.id) await require('./handlers').clearKb(ctx, st.qmsg);
    // Same rule as «Мои авто»: a car that was ever sent or published is archived, not erased.
    await require('../myCars').removeCar(ctx, car);
    return ctx.reply(ctx.t('draft_deleted'), { reply_markup: mainMenu(ctx.t) });
  }
  if (action === 'send') {
    await ctx.answerCallbackQuery();
    const missing = S.missingRequired(car);
    if (missing.length) return ctx.reply(ctx.t('missing_fields', { fields: missing.map(k => ctx.t('f_' + k)).join(', ') }));
    const need = P.photosNeeded(ctx.cars.photos(car.id));
    if (need) return ctx.reply(ctx.t('photos_missing', { n: need }));
    return require('../moderation').submit(ctx, car);
  }
  return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
}

module.exports = { show, onCallback };
