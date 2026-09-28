// One-time registration (SPEC §6.1): name → phone → city → offer.
// The same field steps are reused by the profile editor (profile.js).
const { InlineKeyboard } = require('grammy');
const v = require('../lib/validators');
const { mainMenu, phoneKeyboard, cityKeyboard, removeKeyboard } = require('./menus');

const NEXT = { name: 'phone', phone: 'city', city: 'offer', city_text: 'offer' };

function waUrl(cfg) { return 'https://wa.me/' + cfg.supportWhatsapp.replace(/\D/g, ''); }

async function sendOffer(ctx, withAccept) {
  const kb = new InlineKeyboard();
  if (withAccept) kb.text(ctx.t('btn_accept'), 'reg:accept').row();
  kb.url(ctx.t('btn_questions'), waUrl(ctx.cfg));
  return ctx.reply(ctx.t('offer'), { reply_markup: kb });
}

async function ask(ctx, step) {
  switch (step) {
    case 'name': return ctx.reply(ctx.t('ask_name'), { reply_markup: removeKeyboard });
    case 'phone': return ctx.reply(ctx.t('ask_phone'), { reply_markup: phoneKeyboard(ctx.t) });
    case 'city': return ctx.reply(ctx.t('ask_city'), { reply_markup: cityKeyboard(ctx.t) });
    case 'city_text': return ctx.reply(ctx.t('ask_city_text'), { reply_markup: removeKeyboard });
    case 'offer': return sendOffer(ctx, true);
  }
}

// Validates one field answer. Returns { fields } to save, { goto } to switch
// step, or { error, keyboard } to re-ask.
function readField(t, step, input) {
  if (step === 'name') {
    const r = v.name(input);
    return r.ok ? { fields: { name: r.value } } : { error: 'bad_name' };
  }
  if (step === 'phone') {
    const r = v.phone(input);
    return r.ok ? { fields: { phone: r.value } } : { error: 'bad_phone', keyboard: phoneKeyboard(t) };
  }
  if (step === 'city' || step === 'city_text') {
    if (step === 'city' && v.clean(input) === t('city_other')) return { goto: 'city_text' };
    const r = v.city(input);
    return r.ok ? { fields: { city: r.value } } : { error: 'bad_city', keyboard: step === 'city' ? cityKeyboard(t) : undefined };
  }
  return { error: 'error_generic' };
}

async function start(ctx) {
  const p = ctx.partner;
  const step = p.state && p.state.flow === 'reg' ? p.state.step : null;
  if (step) return ask(ctx, step); // resume where they stopped
  await ctx.reply(ctx.t('welcome'), { reply_markup: removeKeyboard });
  ctx.setState({ flow: 'reg', step: 'name' });
  return ask(ctx, 'name');
}

async function handleAnswer(ctx, input) {
  const step = ctx.partner.state.step;
  if (step === 'offer') {
    await ctx.reply(ctx.t('accept_first'));
    return sendOffer(ctx, true);
  }
  const r = readField(ctx.t, step, input);
  if (r.error) return ctx.reply(ctx.t(r.error), r.keyboard ? { reply_markup: r.keyboard } : {});
  if (r.goto) {
    ctx.setState({ flow: 'reg', step: r.goto });
    return ask(ctx, r.goto);
  }
  ctx.store.update(ctx.partner.id, r.fields);
  const next = NEXT[step];
  ctx.setState({ flow: 'reg', step: next });
  // The offer needs inline buttons, so clear the city keyboard with a short confirmation first.
  if (next === 'offer') await ctx.reply(ctx.t('city_saved', { city: r.fields.city }), { reply_markup: removeKeyboard });
  return ask(ctx, next);
}

const onText = ctx => handleAnswer(ctx, ctx.message.text);

async function onContact(ctx) {
  if (ctx.partner.state.step !== 'phone') return ask(ctx, ctx.partner.state.step);
  const c = ctx.message.contact;
  if (c.user_id !== ctx.from.id) return ctx.reply(ctx.t('foreign_contact'), { reply_markup: phoneKeyboard(ctx.t) });
  return handleAnswer(ctx, c.phone_number);
}

async function onAccept(ctx) {
  const p = ctx.partner;
  if (!(p.state && p.state.flow === 'reg' && p.state.step === 'offer')) {
    return ctx.answerCallbackQuery({ text: ctx.t('stale_button') });
  }
  ctx.store.update(p.id, { offerAcceptedAt: new Date().toISOString(), offerVersion: ctx.cfg.offerVersion });
  ctx.setState(null);
  await ctx.answerCallbackQuery();
  // Keep the "questions" link, drop the accept button so it can't be pressed twice.
  try { await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().url(ctx.t('btn_questions'), waUrl(ctx.cfg)) }); } catch (e) {}
  return ctx.reply(ctx.t('registered'), { reply_markup: mainMenu(ctx.t) });
}

module.exports = { ask, readField, sendOffer, start, onText, onContact, onAccept, waUrl };
