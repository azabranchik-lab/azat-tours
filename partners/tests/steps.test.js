// Pure wizard navigation and parsing (SPEC §6.3, §8).
const test = require('node:test');
const assert = require('node:assert');
const S = require('../bot/carWizard/steps');

test('full sequence: 12 steps; not asked: color, mileage, availability, plate on photos, city', () => {
  assert.deepStrictEqual(S.sequence('full'), [
    'title', 'specs', 'plateNumber', 'features', 'description', 'rentalModes', 'priceSelfDrive', 'priceWithDriver',
    'deposit', 'insDelivery', 'restrictions', 'photos'
  ]);
  assert.strictEqual(S.step('plateOnPhotos'), null);
  assert.strictEqual(S.step('description').required, false);
  assert.deepStrictEqual(S.step('insDelivery').fields, ['insurance', 'delivery', 'minRentalDays']);
});

test('price steps depend on rental modes; «Оба варианта» stores both', () => {
  const withDriver = { rentalModes: ['WITH_DRIVER'] };
  assert.strictEqual(S.nextStep(withDriver, 'rentalModes'), 'priceWithDriver');
  assert.strictEqual(S.prevStep(withDriver, 'priceWithDriver'), 'rentalModes');

  const selfDrive = { rentalModes: ['SELF_DRIVE'] };
  assert.strictEqual(S.nextStep(selfDrive, 'rentalModes'), 'priceSelfDrive');
  assert.strictEqual(S.nextStep(selfDrive, 'priceSelfDrive'), 'deposit');

  const both = { rentalModes: ['SELF_DRIVE', 'WITH_DRIVER'] };
  assert.strictEqual(S.nextStep(both, 'priceSelfDrive'), 'priceWithDriver');
  assert.strictEqual(S.prevStep(both, 'deposit'), 'priceWithDriver');

  const modes = S.step('rentalModes');
  assert.deepStrictEqual(modes.toValue('BOTH'), ['SELF_DRIVE', 'WITH_DRIVER']);
  assert.deepStrictEqual(modes.toValue('WITH_DRIVER'), ['WITH_DRIVER']);
});

test('after the rental terms come the photos', () => {
  assert.strictEqual(S.nextStep({}, 'restrictions'), 'photos');
  assert.strictEqual(S.prevStep({}, 'photos'), 'restrictions');
});

test('first and last steps; edit mode goes back to the summary', () => {
  assert.strictEqual(S.prevStep({}, 'title'), null);
  assert.strictEqual(S.nextStep({}, 'photos'), 'summary');
  assert.strictEqual(S.nextStep({}, 'color', 'edit'), 'summary');
});

test('copy mode asks only the plate, then photos', () => {
  assert.strictEqual(S.nextStep({}, 'plateNumber', 'copy'), 'photos');
  assert.strictEqual(S.nextStep({}, 'photos', 'copy'), 'summary');
  assert.strictEqual(S.prevStep({}, 'plateNumber', 'copy'), null);
});

test('copyFields drops plate, color, mileage and keeps the rest', () => {
  const src = { id: 'src1', make: 'Toyota', model: 'Camry', year: 2019, color: 'белый', plateNumber: '01KG123ABC', mileageKm: 50000, rentalModes: ['SELF_DRIVE'], priceSelfDrive: 3000, restrictions: 'от 25 лет', city: 'Ош', status: 'APPROVED' };
  const c = S.copyFields(src);
  assert.strictEqual(c.make, 'Toyota');
  assert.strictEqual(c.priceSelfDrive, 3000);
  assert.strictEqual(c.restrictions, 'от 25 лет');
  assert.strictEqual(c.city, 'Ош');
  assert.strictEqual(c.copiedFromId, 'src1');
  for (const k of ['color', 'plateNumber', 'mileageKm', 'status', 'id', 'title', 'specs']) assert.ok(!(k in c), k);
});

test('make, model and year in one line', () => {
  const t = s => S.parseText(S.step('title'), s);
  assert.deepStrictEqual(t('Toyota Camry 2019'), { ok: true, value: { make: 'Toyota', model: 'Camry', year: 2019 } });
  assert.deepStrictEqual(t('toyota land cruiser 200 2015').value, { make: 'Toyota', model: 'land cruiser 200', year: 2015 });
  assert.deepStrictEqual(t('Land Rover Defender 2020').value, { make: 'Land Rover', model: 'Defender', year: 2020 });
  assert.deepStrictEqual(t('Мерседес E200 2018г.').value, { make: 'Mercedes-Benz', model: 'E200', year: 2018 });
  assert.deepStrictEqual(t('Mercedes-Benz Sprinter 2016').value, { make: 'Mercedes-Benz', model: 'Sprinter', year: 2016 });
  assert.deepStrictEqual(t('Lexus LX570, 2018 год').value, { make: 'Lexus', model: 'LX570', year: 2018 });
  assert.deepStrictEqual(t('2017 Hyundai Starex').value, { make: 'Hyundai', model: 'Starex', year: 2017 });
  assert.deepStrictEqual(t('Peugeot 4008 2015').value, { make: 'Peugeot', model: '4008', year: 2015 });  // 4008 is not a year
  assert.deepStrictEqual(t('Foton Tunland 2021').value, { make: 'Foton', model: 'Tunland', year: 2021 }); // unknown make: first word
  assert.strictEqual(t('Toyota Camry').error, 'title_no_year');
  assert.strictEqual(t('Toyota Camry 1985').error, 'title_no_year');
  assert.strictEqual(t('Camry 2019').error, 'title_no_model');
  assert.strictEqual(t('Toyota 2019').error, 'title_no_model');
  assert.strictEqual(t('Toyota ' + 'x'.repeat(70) + ' 2019').error, 'title_too_long');
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

test('parseText: group screens take a typed seat count, otherwise buttons only', () => {
  assert.deepStrictEqual(S.parseText(S.step('specs'), '9'), { ok: true, value: { seats: 9 } });
  assert.strictEqual(S.parseText(S.step('specs'), '50').error, 'bad_number');
  assert.strictEqual(S.parseText(S.step('specs'), 'седан').error, 'choose_button');
  assert.deepStrictEqual(S.parseText(S.step('insDelivery'), '7'), { ok: true, value: { minRentalDays: 7 } });
  assert.strictEqual(S.parseText(S.step('insDelivery'), 'каско').error, 'choose_button');
  assert.deepStrictEqual(S.groupMissing(S.step('specs'), { bodyType: 'SUV', seats: 5 }), ['transmission', 'drive', 'fuel']);
});

test('parseText: texts, plate normalisation, buttons-only steps', () => {
  assert.deepStrictEqual(S.parseText(S.step('plateNumber'), '  01kg  123 abc '), { ok: true, value: '01KG 123 ABC' });
  assert.strictEqual(S.parseText(S.step('plateNumber'), 'abc').ok, false);
  assert.strictEqual(S.parseText(S.step('description'), 'коротко').ok, false);
  assert.strictEqual(S.parseText(S.step('bodyType'), 'Седан').error, 'choose_button');
  assert.strictEqual(S.parseText(S.step('features'), 'AC').error, 'choose_button');
  assert.strictEqual(S.parseText(S.step('restrictions'), 'x'.repeat(700)).ok, true);
});

test('missingRequired and inapplicableFields', () => {
  const car = { make: 'Kia', rentalModes: ['WITH_DRIVER'], priceSelfDrive: 2000 };
  const miss = S.missingRequired(car);
  assert.ok(miss.includes('priceWithDriver'));
  assert.ok(miss.includes('bodyType'));
  assert.ok(!miss.includes('priceSelfDrive'));
  assert.ok(!miss.includes('make'));
  assert.ok(!miss.includes('specs') && !miss.includes('title'));   // screens, not fields
  assert.deepStrictEqual(S.inapplicableFields(car), { priceSelfDrive: null });
});

test('resumeStep: saved step (old ones mapped to the new screens), else first missing', () => {
  assert.strictEqual(S.resumeStep({ draftStep: 'summary' }), 'summary');
  assert.strictEqual(S.resumeStep({ draftStep: 'specs' }), 'specs');
  assert.strictEqual(S.resumeStep({ draftStep: 'fuel' }), 'specs');
  assert.strictEqual(S.resumeStep({ draftStep: 'model' }), 'title');
  assert.strictEqual(S.resumeStep({ draftStep: 'insurance' }), 'insDelivery');
  assert.strictEqual(S.resumeStep({ draftStep: 'color' }), 'plateNumber');
  assert.strictEqual(S.resumeStep({ draftStep: 'mileageKm' }), 'features');
  assert.strictEqual(S.resumeStep({ draftStep: 'availabilityNote' }), 'photos');
  assert.strictEqual(S.resumeStep({ draftStep: 'plateOnPhotos' }), 'title');      // removed step: first missing field
  assert.strictEqual(S.resumeStep({ draftStep: 'longTermDiscount' }), 'title');  // removed step: first missing field
  assert.strictEqual(S.resumeStep({ make: 'Kia' }), 'title');
  assert.strictEqual(S.resumeStep({ copiedFromId: 'x', draftStep: 'color' }), 'plateNumber');
  assert.strictEqual(S.resumeStep({ copiedFromId: 'x', draftStep: 'mileageKm', plateNumber: '01KG' }), 'photos');
});
