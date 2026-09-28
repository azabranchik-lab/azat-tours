// Reply keyboards shared by several flows.
const { Keyboard } = require('grammy');

const CITIES = ['Бишкек', 'Каракол', 'Чолпон-Ата', 'Ош', 'Нарын'];

const MENU_KEYS = ['menu_add', 'menu_my', 'menu_profile', 'menu_help'];

function mainMenu(t) {
  return new Keyboard()
    .text(t('menu_add')).text(t('menu_my')).row()
    .text(t('menu_profile')).text(t('menu_help'))
    .resized().persistent();
}

// Which menu button (if any) this text is.
function menuKey(t, text) {
  return MENU_KEYS.find(k => t(k) === text) || null;
}

function phoneKeyboard(t) {
  return new Keyboard().requestContact(t('btn_share_phone')).resized().oneTime();
}

// Partners can tap a city or just type any other one.
function cityKeyboard(t) {
  return new Keyboard()
    .text(CITIES[0]).text(CITIES[1]).text(CITIES[2]).row()
    .text(CITIES[3]).text(CITIES[4]).text(t('city_other'))
    .resized().oneTime();
}

const removeKeyboard = { remove_keyboard: true };

// grammY keeps empty rows from row() calls; Telegram should never see them.
function tidy(kb) {
  kb.inline_keyboard = kb.inline_keyboard.filter(r => r.length);
  return kb;
}

module.exports = { CITIES, mainMenu, menuKey, phoneKeyboard, cityKeyboard, removeKeyboard, tidy };
