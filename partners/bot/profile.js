// Profile (SPEC §6.8): show data, edit name / phone / city, show the offer.
const { InlineKeyboard } = require('grammy');
const reg = require('./registration');
const { mainMenu, phoneKeyboard } = require('./menus');

const fmtDate = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '-' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

async function show(ctx) {
  const p = ctx.store.getById(ctx.partner.id);
  const kb = new InlineKeyboard()
    .text(ctx.t('btn_edit_name'), 'prof:name').row()
    .text(ctx.t('btn_edit_phone'), 'prof:phone').row()
    .text(ctx.t('btn_edit_city'), 'prof:city').row()
    .text(ctx.t('btn_offer'), 'prof:offer');
  return ctx.reply(ctx.t('profile', { name: p.name, phone: p.phone, city: p.city, accepted: fmtDate(p.offerAcceptedAt) }), { reply_markup: kb });
}

async function onCallback(ctx, action) {
  await ctx.answerCallbackQuery();
  if (action === 'offer') return reg.sendOffer(ctx, false);
  if (!['name', 'phone', 'city'].includes(action)) return;
  ctx.setState({ flow: 'profile', step: action });
  return reg.ask(ctx, action);
}

async function handleAnswer(ctx, input) {
  const step = ctx.partner.state.step;
  const r = reg.readField(ctx.t, step, input);
  if (r.error) return ctx.reply(ctx.t(r.error), r.keyboard ? { reply_markup: r.keyboard } : {});
  if (r.goto) {
    ctx.setState({ flow: 'profile', step: r.goto });
    return reg.ask(ctx, r.goto);
  }
  ctx.store.update(ctx.partner.id, r.fields);
  ctx.setState(null);
  await ctx.reply(ctx.t('saved'), { reply_markup: mainMenu(ctx.t) });
  return show(ctx);
}

const onText = ctx => handleAnswer(ctx, ctx.message.text);

async function onContact(ctx) {
  if (ctx.partner.state.step !== 'phone') return reg.ask(ctx, ctx.partner.state.step);
  const c = ctx.message.contact;
  if (c.user_id !== ctx.from.id) return ctx.reply(ctx.t('foreign_contact'), { reply_markup: phoneKeyboard(ctx.t) });
  return handleAnswer(ctx, c.phone_number);
}

module.exports = { show, onCallback, onText, onContact };
