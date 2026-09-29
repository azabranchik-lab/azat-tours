// Pure wizard navigation and parsing (SPEC §6.3, §8).
const test = require('node:test');
const assert = require('node:assert');
const S = require('../bot/carWizard/steps');

test('full sequence: 25 steps ending with plate choice and photos, city is not asked', () => {
  const seq = S.sequence('full');
  assert.strictEqual(seq.length, 25);
  assert.strictEqual(seq[0], 'make');
  assert.deepStrictEqual(seq.slice(-2), ['plateOnPhotos', 'photos']);
  assert.ok(!seq.includes('city'));
});

test('price and driver steps depend on rental modes', () => {
  const withDriver = { rentalModes: ['WITH_DRIVER'] };
  assert.strictEqual(S.nextStep(withDriver, 'rentalModes'), 'priceWithDriver');
  assert.strictEqual(S.nextStep(withDriver, 'delivery'), 'restrictions');       // no driverRequirements
  assert.strictEqual(S.prevStep(withDriver, 'priceWithDriver'), 'rentalModes');

  const selfDrive = { rentalModes: ['SELF_DRIVE'] };
  assert.strictEqual(S.nextStep(selfDrive, 'rentalModes'), 'priceSelfDrive');
  assert.strictEqual(S.nextStep(selfDrive, 'priceSelfDrive'), 'longTermDiscount');
  assert.strictEqual(S.nextStep(selfDrive, 'delivery'), 'driverRequirements');

  const both = { rentalModes: ['SELF_DRIVE', 'WITH_DRIVER'] };
  assert.strictEqual(S.nextStep(both, 'priceSelfDrive'), 'priceWithDriver');
  assert.strictEqual(S.prevStep(both, 'longTermDiscount'), 'priceWithDriver');
});

test('first and last steps; edit mode goes back to the summary', () => {
  assert.strictEqual(S.prevStep({}, 'make'), null);
  assert.strictEqual(S.nextStep({}, 'photos'), 'summary');
  assert.strictEqual(S.nextStep({}, 'color', 'edit'), 'summary');
});

test('copy mode asks only color, plate, mileage, then photos', () => {
  assert.strictEqual(S.nextStep({}, 'color', 'copy'), 'plateNumber');
  assert.strictEqual(S.nextStep({}, 'plateNumber', 'copy'), 'mileageKm');
  assert.strictEqual(S.nextStep({}, 'mileageKm', 'copy'), 'photos');
  assert.strictEqual(S.nextStep({}, 'photos', 'copy'), 'summary');
  assert.strictEqual(S.prevStep({}, 'color', 'copy'), null);
});

test('copyFields drops plate, color, mileage and keeps the rest', () => {
  const src = { id: 'src1', make: 'Toyota', model: 'Camry', year: 2019, color: 'белый', plateNumber: '01KG123ABC', mileageKm: 50000, rentalModes: ['SELF_DRIVE'], priceSelfDrive: 3000, city: 'Ош', status: 'APPROVED' };
  const c = S.copyFields(src);
  assert.strictEqual(c.make, 'Toyota');
  assert.strictEqual(c.priceSelfDrive, 3000);
  assert.strictEqual(c.city, 'Ош');
  assert.strictEqual(c.copiedFromId, 'src1');
  for (const k of ['color', 'plateNumber', 'mileageKm', 'status', 'id']) assert.ok(!(k in c), k);
});

test('parseText: numbers', () => {
  const year = S.step('year');
  assert.deepStrictEqual(S.parseText(year, '2019'), { ok: true, value: 2019 });
  assert.strictEqual(S.parseText(year, '1989').ok, false);
  assert.strictEqual(S.parseText(year, String(new Date().getFullYear() + 2)).ok, false);
  const price = S.step('priceSelfDrive');
  assert.deepStrictEqual(S.parseText(price, '3 500 сом'), { ok: true, value: 3500 });
  assert.deepStrictEqual(S.parseText(price, '1'), { ok: true, value: 1 });      // any price, owner's rule
  assert.strictEqual(S.parseText(price, '0').ok, false);
  assert.strictEqual(S.parseText(price, '3.5').ok, false);
  assert.deepStrictEqual(S.parseText(S.step('deposit'), '0'), { ok: true, value: 0 });
  assert.deepStrictEqual(S.parseText(S.step('mileageKm'), '120 000 км'), { ok: true, value: 120000 });
});

test('parseText: texts, plate normalisation, buttons-only steps', () => {
  assert.deepStrictEqual(S.parseText(S.step('plateNumber'), '  01kg  123 abc '), { ok: true, value: '01KG 123 ABC' });
  assert.strictEqual(S.parseText(S.step('plateNumber'), 'abc').ok, false);
  assert.strictEqual(S.parseText(S.step('description'), 'коротко').ok, false);
  assert.strictEqual(S.parseText(S.step('bodyType'), 'Седан').error, 'choose_button');
  assert.strictEqual(S.parseText(S.step('features'), 'AC').error, 'choose_button');
});

test('missingRequired and inapplicableFields', () => {
  const car = { make: 'Kia', rentalModes: ['WITH_DRIVER'], priceSelfDrive: 2000, driverRequirements: 'от 25 лет' };
  const miss = S.missingRequired(car);
  assert.ok(miss.includes('priceWithDriver'));
  assert.ok(!miss.includes('priceSelfDrive'));
  assert.ok(!miss.includes('make'));
  assert.deepStrictEqual(S.inapplicableFields(car), { priceSelfDrive: null, driverRequirements: null });
});

test('resumeStep: saved step, else first missing', () => {
  assert.strictEqual(S.resumeStep({ draftStep: 'fuel' }), 'fuel');
  assert.strictEqual(S.resumeStep({ draftStep: 'summary' }), 'summary');
  assert.strictEqual(S.resumeStep({ make: 'Kia' }), 'model');
});
