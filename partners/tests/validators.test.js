const test = require('node:test');
const assert = require('node:assert');
const v = require('../lib/validators');

test('phone: Kyrgyz formats normalize to +996XXXXXXXXX', () => {
  for (const input of ['+996 555 123 456', '996555123456', '0555 123 456', '555123456', '+996(555)12-34-56', '00996555123456']) {
    assert.deepStrictEqual(v.phone(input), { ok: true, value: '+996555123456' }, input);
  }
});

test('phone: international numbers are kept', () => {
  assert.deepStrictEqual(v.phone('+7 701 123 45 67'), { ok: true, value: '+77011234567' });
  assert.deepStrictEqual(v.phone('77011234567'), { ok: true, value: '+77011234567' }); // Telegram contact without +
});

test('phone: garbage is rejected', () => {
  for (const input of ['', 'abc', '12345', '+996 555', 'позвоните мне', '0555']) {
    assert.strictEqual(v.phone(input).ok, false, input);
  }
});

test('name: 2-100 chars, whitespace collapsed', () => {
  assert.deepStrictEqual(v.name('  Ош   Авто '), { ok: true, value: 'Ош Авто' });
  assert.strictEqual(v.name('A').ok, false);
  assert.strictEqual(v.name('x'.repeat(101)).ok, false);
});

test('city: 2-60 chars', () => {
  assert.deepStrictEqual(v.city('Талас'), { ok: true, value: 'Талас' });
  assert.strictEqual(v.city(' ').ok, false);
});
