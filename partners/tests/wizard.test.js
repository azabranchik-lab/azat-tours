// End-to-end add-car wizard through the real bot (SPEC §6.3, §6.5).
const test = require('node:test');
const assert = require('node:assert');
const { setup, USER } = require('./helpers');
const { insDelivery } = require('./flows');
const S = require('../bot/carWizard/steps');

const draftOf = s => s.cars.latestDraft(s.store.getByTelegramId(USER).id);

// Walks the whole wizard for a self-drive car. Returns the draft.
async function fillFullCar(s) {
  await s.send('Добавить авто');
  assert.match(s.lastText(), /Шаг 1 из 11\nМарка, модель и год/);   // 12 steps minus priceWithDriver: self-drive assumed until modes are chosen
  await s.send('Toyota Land Cruiser 200 2019');
  assert.match(s.texts().at(-2), /Записали: марка Toyota, модель Land Cruiser 200, год 2019/);
  assert.match(s.lastText(), /Шаг 2 из 11\nХарактеристики/);
  await s.tap('Внедорожник (SUV)');
  await s.tap('Автомат');
  await s.tap('Полный 4x4');
  await s.tap('Дизель');
  await s.send('7');                              // seats can be typed on the screen
  assert.match(s.lastText(), /Кузов: Внедорожник \(SUV\)\nКоробка: Автомат\nПривод: Полный 4x4\nТопливо: Дизель\nМест: 7/);
  await s.tap('Готово');
  await s.send('01kg 123 abc');
  await s.tap('Кондиционер'); await s.tap('Зимняя резина'); await s.tap('Готово');
  await s.send('Ухоженная машина, подходит для гор и бездорожья, салон кожаный.');
  await s.tap('Без водителя');                    // one tap, no «Готово»
  await s.send('4500');
  await s.send('0');                              // deposit
  await insDelivery(s, 'ОСАГО (обязательная)', 'Нет, клиент забирает сам', '1 день');
  await s.send('от 23 лет, стаж от 3 лет, до 300 км в сутки');
  assert.match(s.lastText(), /^Шаг 11 из 11\nФото/);
  await s.sendPhotos(4);
  await s.tap('Готово');
  return draftOf(s);
}

test('full wizard → summary with every field', async () => {
  const s = setup();
  await s.register();
  const car = await fillFullCar(s);

  assert.strictEqual(car.make, 'Toyota');
  assert.strictEqual(car.model, 'Land Cruiser 200');
  assert.strictEqual(car.year, 2019);
  assert.strictEqual(car.bodyType, 'SUV');
  assert.strictEqual(car.fuel, 'DIESEL');
  assert.strictEqual(car.seats, 7);
  assert.strictEqual(car.plateNumber, '01KG 123 ABC');
  assert.deepStrictEqual(car.features, ['AC', 'WINTER_TIRES']);
  assert.deepStrictEqual(car.rentalModes, ['SELF_DRIVE']);
  assert.strictEqual(car.priceSelfDrive, 4500);
  assert.strictEqual(car.priceWithDriver, null);
  assert.strictEqual(car.deposit, 0);
  assert.strictEqual(car.insurance, 'OSAGO');
  assert.strictEqual(car.delivery, 'NO');
  assert.strictEqual(car.minRentalDays, 1);
  assert.strictEqual(car.plateOnPhotos, 'BLUR');              // not asked: we blur it ourselves
  assert.strictEqual(car.restrictions, 'от 23 лет, стаж от 3 лет, до 300 км в сутки');
  assert.strictEqual(car.availabilityNote, 'Круглый год');
  assert.strictEqual(car.city, 'Бишкек');                 // from the profile
  assert.strictEqual(car.color, null);                    // not asked any more
  assert.strictEqual(car.status, 'DRAFT');

  const summary = s.lastText();
  assert.match(summary, /^Проверьте анкету/);
  assert.match(summary, /Госномер: 01KG 123 ABC/);
  assert.match(summary, /Формат аренды: Без водителя/);
  assert.match(summary, /Залог, сом: без залога/);
  assert.match(summary, /Условия аренды: от 23 лет/);
  assert.ok(!/Цвет|Пробег/.test(summary));                // empty optional extras are not shown
  assert.ok(!/С водителем, сом/.test(summary));           // not applicable, not shown
  assert.match(summary, /Минимальный срок: 1 день/);
  assert.match(summary, /Когда свободно: Круглый год/);
  assert.ok(!/Номер на фото/.test(summary));
  assert.match(summary, /Фото: 4, главное первое/);

  await s.tap('Отправить на проверку');
  assert.match(s.lastText(), /отправлено на проверку/);
});

test('group screen: «Готово» waits until every row is chosen; the answered screen is frozen', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('Kia Rio 2018');
  await s.tap('Готово');
  assert.match(s.lastAnswer(), /Ещё не выбрано: Кузов, Коробка, Привод, Топливо, Мест/);
  await s.tap('Седан'); await s.tap('Механика'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  await s.tap('✓ Седан');                                 // tapping the chosen one again keeps it
  assert.ok(s.hasButton('✓ Механика'));
  await s.tap('Готово');
  assert.match(s.lastText(), /Госномер/);
  assert.ok(!s.hasButton('✓ Механика'));                  // the screen's buttons are gone
  assert.match(s.texts().at(-2), /Коробка: Механика/);
  const car = draftOf(s);
  assert.deepStrictEqual([car.bodyType, car.transmission, car.drive, car.fuel, car.seats], ['SEDAN', 'MANUAL', 'FWD', 'PETROL', 5]);
});

test('wrong input re-asks; buttons-only screen rejects text; back and cancel keep the draft', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('Camry 2019');                             // no make
  assert.match(s.lastText(), /Напишите марку и модель/);
  await s.send('Chevrolet Nexia');                        // no year
  assert.match(s.lastText(), /Не нашли год выпуска \(от 1990/);
  await s.send('Chevrolet Nexia 1950');
  assert.match(s.lastText(), /Не нашли год выпуска/);
  await s.send('Chevrolet Nexia 2015');
  await s.send('седан');                                  // the specs screen needs buttons
  assert.match(s.texts().at(-2), /кнопкой/);
  assert.match(s.lastText(), /Характеристики/);
  await s.send('50');                                     // a typed seat count is checked
  assert.match(s.lastText(), /от 1 до 30/);
  await s.tap('Назад');
  assert.match(s.lastText(), /Марка, модель и год/);
  await s.tap('Отмена');
  assert.match(s.lastText(), /Черновик сохранён/);

  // Resume: the draft is offered and continues at the saved step.
  await s.send('Добавить авто');
  assert.match(s.lastText(), /незаконченная анкета: Chevrolet Nexia 2015/);
  await s.tap('Продолжить');
  assert.match(s.lastText(), /Марка, модель и год/);
});

test('stale buttons of an old screen do nothing', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('Honda Fit 2012');
  await s.tap('Седан'); await s.tap('Автомат'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  await s.tap('Готово');
  await s.press(`w:${S.step('specs').index}:g:0:1`);      // the old «Внедорожник» button
  assert.match(s.lastAnswer(), /неактуальна/);
  assert.strictEqual(draftOf(s).bodyType, 'SEDAN');
});

test('«Оба варианта» asks both prices', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('Hyundai Starex 2017');
  await s.tap('Минивэн'); await s.tap('Автомат'); await s.tap('Задний'); await s.tap('Дизель'); await s.tap('8'); await s.tap('Готово');
  await s.send('01KG 555 XYZ');
  await s.tap('Пропустить');                              // features
  await s.tap('Пропустить');                              // description is optional now
  await s.tap('Оба варианта');
  assert.match(s.lastText(), /без водителя, сом/);
  await s.send('4000');
  assert.match(s.lastText(), /с водителем, сом/);
  await s.send('6000');
  const car = draftOf(s);
  assert.deepStrictEqual(car.rentalModes, ['SELF_DRIVE', 'WITH_DRIVER']);
  assert.deepStrictEqual([car.priceSelfDrive, car.priceWithDriver], [4000, 6000]);
});

test('summary edit: switching to "with driver" asks for the new price and clears self-drive data', async () => {
  const s = setup();
  await s.register();
  await fillFullCar(s);
  await s.tap('Изменить');
  await s.tap('Формат аренды');
  await s.tap('С водителем');
  assert.match(s.lastText(), /с водителем, сом/);        // made required by the edit
  await s.send('6000');
  assert.match(s.lastText(), /^Проверьте анкету/);
  let car = draftOf(s);
  assert.deepStrictEqual(car.rentalModes, ['WITH_DRIVER']);
  assert.strictEqual(car.priceWithDriver, 6000);
  assert.strictEqual(car.priceSelfDrive, null);

  // One field of a screen is edited on its own.
  await s.tap('Изменить');
  await s.tap('Кузов');
  await s.tap('Пикап');
  assert.match(s.lastText(), /Кузов: Пикап/);
  car = draftOf(s);
  assert.strictEqual(car.bodyType, 'PICKUP');
  assert.strictEqual(car.fuel, 'DIESEL');
});

test('copy an existing car: only the plate and photos are asked', async () => {
  const s = setup();
  await s.register();
  const first = await fillFullCar(s);
  s.cars.update(first.id, { status: 'APPROVED' });       // pretend it was published

  await s.send('Добавить авто');
  await s.tap('Копия: Toyota Land Cruiser 200 2019');
  assert.match(s.texts().at(-2), /Скопировали данные .* Осталось указать госномер и фото/);
  assert.match(s.lastText(), /Шаг 1 из 2\nГосномер/);
  await s.send('01KG 777 AAA');
  assert.match(s.lastText(), /^Шаг 2 из 2\nФото/);        // photos are never copied
  await s.sendPhotos(4);
  await s.tap('Готово');
  assert.match(s.lastText(), /^Проверьте анкету/);
  const copy = s.cars.latestDraft(first.partnerId);
  assert.strictEqual(copy.copiedFromId, first.id);
  assert.strictEqual(copy.priceSelfDrive, 4500);
  assert.strictEqual(copy.restrictions, first.restrictions);
  assert.strictEqual(copy.plateNumber, '01KG 777 AAA');
  assert.strictEqual(copy.color, null);
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
  const s2 = setup(s1.conn);
  await s2.send('Kia Sportage 2020');
  assert.match(s2.lastText(), /Характеристики/);
});
