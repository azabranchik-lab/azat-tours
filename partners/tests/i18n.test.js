// Every t('key') used in partners/ code must exist in ru.js (SPEC §8).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ru, t } = require('../i18n');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['i18n', 'tests', 'node_modules', 'data', 'scripts'].includes(e.name) ? [] : jsFiles(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

test('all i18n keys used in code exist in ru.js', () => {
  const used = new Set();
  for (const f of jsFiles(path.join(__dirname, '..'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-z_A-Z]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/translate\(\s*'RU',\s*'([a-z_A-Z]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/error: '([a-z_]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size > 10, 'scanner found keys');
  const missing = [...used].filter(k => !k.endsWith('_') && !(k in ru)); // 'q_' + key etc. are checked below
  assert.deepStrictEqual(missing, []);
});

test('every wizard step has its question, label, enum and preset texts', () => {
  const { STEPS } = require('../bot/carWizard/steps');
  const need = [];
  for (const s of STEPS) {
    need.push('q_' + s.key, 'f_' + s.key);
    for (const o of s.options || []) need.push('enum_' + o);
    if (s.other) need.push(s.other, s.other + '_ask');
    if (s.presets && !s.presetsRaw && s.type !== 'int') need.push(...s.presets);
  }
  assert.deepStrictEqual(need.filter(k => !(k in ru)), []);
});

test('t() fills params and leaves unknown placeholders', () => {
  assert.strictEqual(t('RU', 'city_saved', { city: 'Ош' }), 'Город: Ош');
  assert.match(t('RU', 'welcome', { percent: 15 }), /15%/);
  assert.throws(() => t('RU', 'no_such_key'));
});

test('bot texts have no em/en dashes', () => {
  const bad = Object.entries(ru).filter(([, s]) => /[—–]/.test(s)).map(([k]) => k);
  assert.deepStrictEqual(bad, []);
});
