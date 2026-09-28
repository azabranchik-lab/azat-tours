// t(lang, key, params): every partner-facing text goes through here (SPEC §8).
// Only Russian exists in v1; any other lang falls back to it.
const ru = require('./ru');

const LANGS = { RU: ru };

function t(lang, key, params = {}) {
  const dict = LANGS[lang] || ru;
  const s = dict[key] !== undefined ? dict[key] : ru[key];
  if (s === undefined) throw new Error(`i18n: missing key "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
}

module.exports = { t, ru };
