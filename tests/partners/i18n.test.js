// Every t('key') used in partners/ code must exist in ru.js (SPEC §8).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ru, t } = require('../../partners/i18n');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'i18n' ? [] : jsFiles(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

test('all i18n keys used in code exist in ru.js', () => {
  const used = new Set();
  for (const f of jsFiles(path.join(__dirname, '..', '..', 'partners'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-z_A-Z]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/translate\(\s*'RU',\s*'([a-z_A-Z]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/error: '([a-z_]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size > 10, 'scanner found keys');
  const missing = [...used].filter(k => !(k in ru));
  assert.deepStrictEqual(missing, []);
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
