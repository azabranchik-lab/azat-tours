// End-to-end add-car wizard through the real bot (SPEC §6.3, §6.5).
const test = require('node:test');
const assert = require('node:assert');
const { setup } = require('./helpers');

// Walks the whole wizard for a self-drive car. Returns the draft.
async function fillFullCar(s) {
  await s.send('Добавить авто');
  assert.match(s.lastText(), /Шаг 1 из 24\nМарка/);   // 25 steps minus priceWithDriver: self-drive assumed until modes are chosen
  await s.tap('Toyota');
  await s.send('Land Cruiser 200');
  await s.send('2019');
  await s.tap('Внедорожник (SUV)');
  await s.tap('Автомат');
  await s.tap('Полный 4x4');
  await s.tap('Дизель');
  await s.tap('7');
  await s.send('белый');
  await s.send('01kg 123 abc');
  await s.send('120 000');
  await s.tap('Кондиционер'); await s.tap('Зимняя резина'); await s.tap('Готово');
  await s.send('Ухоженная машина, подходит для гор и бездорожья, салон кожаный.');
  await s.tap('Без водителя'); await s.tap('Готово');
  await s.send('4500');
  await s.tap('Пропустить');                     // longTermDiscount
  await s.send('0');                              // deposit
  await s.tap('ОСАГО (обязательная)');
  await s.tap('Нет, клиент забирает сам');
  await s.send('от 23 лет, стаж от 3 лет');
  await s.tap('Пропустить');                     // restrictions
  await s.tap('Круглый год');
  await s.tap('Сниму так, чтобы номера не было видно');
  await s.sendPhotos(8);
  await s.tap('Готово');                          // no extra photos
  return s.cars.latestDraft(s.store.getByTelegramId(require('./helpers').USER).id);
}

test('full wizard → summary with every field', async () => {
  const s = setup();
  await s.register();
  const car = await fillFullCar(s);

  assert.strictEqual(car.make, 'Toyota');
  assert.strictEqual(car.year, 2019);
  assert.strictEqual(car.plateNumber, '01KG 123 ABC');
  assert.deepStrictEqual(car.features, ['AC', 'WINTER_TIRES']);
  assert.deepStrictEqual(car.rentalModes, ['SELF_DRIVE']);
  assert.strictEqual(car.priceSelfDrive, 4500);
  assert.strictEqual(car.priceWithDriver, null);
  assert.strictEqual(car.deposit, 0);
  assert.strictEqual(car.longTermDiscount, null);
  assert.strictEqual(car.availabilityNote, 'Круглый год');
  assert.strictEqual(car.city, 'Бишкек');                 // from the profile
  assert.strictEqual(car.status, 'DRAFT');

  const summary = s.lastText();
  assert.match(summary, /^Проверьте анкету/);
  assert.match(summary, /Госномер: 01KG 123 ABC/);
  assert.match(summary, /Залог, сом: без залога/);
  assert.match(summary, /Пробег: 120\s000 км/);
  assert.ok(!/С водителем, сом/.test(summary));           // not applicable, not shown
  assert.match(summary, /Номер на фото: Сниму так/);
  assert.match(summary, /Фото: 8 из 8, доп.: 0/);

  await s.tap('Отправить на проверку');
  assert.match(s.lastText(), /в следующем обновлении/);
});

test('wrong input re-asks; buttons-only step rejects text; back and cancel keep the draft', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('X');                                      // make too short
  assert.match(s.lastText(), /от 2 до 40/);
  await s.send('Chevrolet');                              // typed make is fine
  await s.send('Nexia');
  await s.send('1950');
  assert.match(s.lastText(), /от 1990/);
  await s.send('2015');
  await s.send('седан');                                  // bodyType needs a button
  assert.match(s.texts().at(-2), /кнопкой/);
  assert.match(s.lastText(), /Тип кузова/);
  await s.tap('Назад');
  assert.match(s.lastText(), /Год выпуска/);
  await s.tap('Отмена');
  assert.match(s.lastText(), /Черновик сохранён/);

  // Resume: the draft is offered and continues at the saved step.
  await s.send('Добавить авто');
  assert.match(s.lastText(), /незаконченная анкета: Chevrolet Nexia 2015/);
  await s.tap('Продолжить');
  assert.match(s.lastText(), /Год выпуска/);
});

test('stale buttons of an old question do nothing', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('Honda'); await s.send('Fit'); await s.send('2012');
  await s.press('w:0:p:0');                               // the old «Toyota» button on step 1
  assert.match(s.lastAnswer(), /неактуальна/);
  const car = s.cars.latestDraft(s.store.getByTelegramId(require('./helpers').USER).id);
  assert.strictEqual(car.make, 'Honda');
});

test('summary edit: switching to "with driver" asks for the new price and clears self-drive data', async () => {
  const s = setup();
  await s.register();
  await fillFullCar(s);
  await s.tap('Изменить');
  await s.tap('Формат аренды');
  await s.tap('✓ Без водителя');                          // untick (selected options show a tick)
  await s.tap('С водителем');
  await s.tap('Готово');
  assert.match(s.lastText(), /с водителем, сом/);        // made required by the edit
  await s.send('6000');
  assert.match(s.lastText(), /^Проверьте анкету/);
  const car = s.cars.latestDraft(s.store.getByTelegramId(require('./helpers').USER).id);
  assert.deepStrictEqual(car.rentalModes, ['WITH_DRIVER']);
  assert.strictEqual(car.priceWithDriver, 6000);
  assert.strictEqual(car.priceSelfDrive, null);
  assert.strictEqual(car.driverRequirements, null);
});

test('copy an existing car: only color, plate, mileage are asked', async () => {
  const s = setup();
  await s.register();
  const first = await fillFullCar(s);
  s.cars.update(first.id, { status: 'APPROVED' });       // pretend it was published

  await s.send('Добавить авто');
  await s.tap('Копия: Toyota Land Cruiser 200 2019');
  assert.match(s.texts().at(-2), /Скопировали данные/);
  assert.match(s.lastText(), /Шаг 1 из 4\nЦвет/);
  await s.send('чёрный');
  await s.send('01KG 777 AAA');
  await s.tap('Пропустить');
  assert.match(s.lastText(), /Фото 1\/8: спереди/);        // photos are never copied
  await s.sendPhotos(8);
  await s.tap('Готово');
  assert.match(s.lastText(), /^Проверьте анкету/);
  const copy = s.cars.latestDraft(first.partnerId);
  assert.strictEqual(copy.copiedFromId, first.id);
  assert.strictEqual(copy.priceSelfDrive, 4500);
  assert.strictEqual(copy.color, 'чёрный');
  assert.strictEqual(copy.mileageKm, null);
});

test('delete draft asks for confirmation', async () => {
  const s = setup();
  await s.register();
  const car = await fillFullCar(s);
  await s.tap('Удалить черновик');
  assert.match(s.lastText(), /Удалить Toyota Land Cruiser 200 2019\?/);
  await s.tap('Да, удалить');
  assert.match(s.lastText(), /Черновик удалён/);
  assert.strictEqual(s.cars.get(car.id), null);
});

test('restart mid-wizard: new bot on the same DB accepts the next answer', async () => {
  const s1 = setup();
  await s1.register();
  await s1.send('Добавить авто');
  await s1.tap('Kia');
  const s2 = setup(s1.conn);
  await s2.send('Sportage');
  assert.match(s2.lastText(), /Год выпуска/);
});
