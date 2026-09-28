// Summary of a draft (SPEC §6.5): card + «Отправить на проверку» / «Изменить» /
// «Удалить черновик». Photos and the actual submit arrive in phases 3-4.
const { InlineKeyboard } = require('grammy');
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
  const fields = S.STEPS.filter(s => S.applies(s, car));
  fields.forEach((s, i) => { kb.text(ctx.t('f_' + s.key), `sum:f:${car.id}:${S.step(s.key).index}`); if (i % 2 === 1) kb.row(); });
  return tidy(kb.row().text(ctx.t('btn_back'), `sum:show:${car.id}`));
}

async function show(ctx, car) {
  const { clearKb } = require('./handlers');
  await clearKb(ctx, ctx.partner.state && ctx.partner.state.qmsg);
  ctx.cars.update(car.id, { draftStep: 'summary' });
  const msg = await ctx.reply(`${ctx.t('summary_title')}\n\n${carCard(car, ctx.t)}`, { reply_markup: summaryKeyboard(ctx, car) });
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
    if (st && st.carId === car.id) {
      const { clearKb } = require('./handlers');
      await clearKb(ctx, st.qmsg);
      ctx.setState(null);
    }
    ctx.cars.remove(car.id);
    return ctx.reply(ctx.t('draft_deleted'), { reply_markup: mainMenu(ctx.t) });
  }
  if (action === 'send') {
    await ctx.answerCallbackQuery();
    const missing = S.missingRequired(car);
    if (missing.length) return ctx.reply(ctx.t('missing_fields', { fields: missing.map(k => ctx.t('f_' + k)).join(', ') }));
    return ctx.reply(ctx.t('photos_next_phase'));
  }
  return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
}

module.exports = { show, onCallback };
