// End-to-end add-car wizard through the real bot (SPEC §6.3, §6.5).
const test = require('node:test');
const assert = require('node:assert');
const { setup, USER } = require('./helpers');
const { insDelivery } = require('./flows');
const S = require('../bot/carWizard/steps');

const draftOf = s => s.cars.latestDraft(s.store.getByTelegramId(USER).id);

// Walks the whole wizard (every car is self-drive since 2026-10-18). Returns the draft.
async function fillFullCar(s) {
  await s.send('Добавить авто');
  assert.match(s.lastText(), /Шаг 1 из 7\nМарка, модель и год/);
  await s.send('Toyota Land Cruiser 200 2019');
  assert.match(s.texts().at(-2), /Записали: марка Toyota, модель Land Cruiser 200, год 2019/);
  assert.match(s.lastText(), /Шаг 2 из 7\nХарактеристики/);
  await s.tap('Внедорожник (SUV)');
  await s.tap('Автомат');
  await s.tap('Полный 4x4');
  await s.tap('Дизель');
  await s.send('7');                              // seats can be typed on the screen
  assert.match(s.lastText(), /Кузов: Внедорожник \(SUV\)\nКоробка: Автомат\nПривод: Полный 4x4\nТопливо: Дизель\nМест: 7/);
  await s.tap('Готово');
  assert.match(s.lastText(), /^Шаг 3 из 7\nЦена аренды за сутки, сом\?/);   // no plate, equipment, description or rental mode
  await s.send('4500');
  assert.match(s.lastText(), /^Шаг 4 из 7\nЗалог.*нажмите «Пропустить»/);
  await s.tap('Пропустить');                      // «Пропустить» = no deposit
  assert.match(s.texts().at(-2), /→ без залога$/);
  assert.match(s.lastText(), /^Шаг 5 из 7\nСтраховка, доставка/);
  await insDelivery(s, 'Страховка ОСАГО (обязательная)', 'Без доставки, клиент забирает сам', 'От 1 дня');
  assert.match(s.lastText(), /^Шаг 6 из 7\nКомментарий/);
  await s.send('Кондиционер, зимняя резина. От 23 лет, стаж от 3 лет, до 300 км в сутки');
  assert.match(s.lastText(), /^Шаг 7 из 7\nФото/);
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
  assert.strictEqual(car.plateNumber, null);              // read from the photos
  assert.deepStrictEqual(car.features, []);
  assert.deepStrictEqual(car.rentalModes, ['SELF_DRIVE']); // set for every new car, not asked
  assert.strictEqual(car.priceSelfDrive, 4500);
  assert.strictEqual(car.priceWithDriver, null);
  assert.strictEqual(car.deposit, 0);
  assert.strictEqual(car.insurance, 'OSAGO');
  assert.strictEqual(car.delivery, 'NO');
  assert.strictEqual(car.minRentalDays, 1);
  assert.strictEqual(car.plateOnPhotos, null);            // hidden on the site only if the partner asks
  assert.strictEqual(car.restrictions, 'Кондиционер, зимняя резина. От 23 лет, стаж от 3 лет, до 300 км в сутки');
  assert.strictEqual(car.availabilityNote, 'Круглый год');
  assert.strictEqual(car.city, 'Бишкек');                 // from the profile
  assert.strictEqual(car.color, null);                    // not asked any more
  assert.strictEqual(car.status, 'DRAFT');

  const summary = s.lastText();
  assert.match(summary, /^Проверьте анкету/);
  assert.match(summary, /Цена, сом\/сутки: 4\s500/);
  assert.match(summary, /Залог, сом: без залога/);
  assert.match(summary, /Комментарий: Кондиционер, зимняя резина/);
  assert.ok(!/Цвет|Пробег|Госномер|Оснащение|Описание/.test(summary)); // empty optional extras are not shown
  assert.ok(!/С водителем, сом/.test(summary));           // not applicable, not shown
  assert.match(summary, /Минимальный срок: 1 день/);
  assert.match(summary, /Когда свободно: Круглый год/);
  assert.ok(!/Номер на фото/.test(summary));
  assert.match(summary, /Фото: 4, главное первое/);

  // «Изменить» offers neither the dropped questions nor the rental mode.
  await s.tap('Изменить');
  for (const b of ['Оснащение', 'Описание', 'Формат аренды', 'С водителем, сом/сутки']) assert.ok(!s.hasButton(b), b);
  assert.ok(s.hasButton('Комментарий') && s.hasButton('Госномер'));
  await s.tap('Назад');

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
  assert.match(s.lastText(), /Цена аренды/);
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

test('insurance, delivery and term: every button says which question it answers', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('Hyundai Starex 2017');
  await s.tap('Минивэн'); await s.tap('Автомат'); await s.tap('Задний'); await s.tap('Дизель'); await s.tap('8'); await s.tap('Готово');
  await s.send('4000');
  await s.send('20000');
  for (const b of ['Страховка ОСАГО (обязательная)', 'Страховка КАСКО', 'Без страховки', 'Доставка бесплатно',
    'Доставка за доплату', 'Без доставки, клиент забирает сам', 'От 1 дня', 'От 2 дней', 'От 3 дней']) assert.ok(s.hasButton(b), b);
  await s.tap('Страховка КАСКО'); await s.tap('Доставка бесплатно'); await s.tap('От 3 дней');
  assert.ok(s.hasButton('✓ Доставка бесплатно'));
  assert.match(s.lastText(), /Страховка: КАСКО\nДоставка: Да, бесплатно\nМинимальный срок: 3 дня/);
  await s.tap('Готово');
  const car = draftOf(s);
  assert.deepStrictEqual([car.deposit, car.insurance, car.delivery, car.minRentalDays], [20000, 'KASKO', 'FREE', 3]);
});

test('an older draft with a driver is continued as self-drive', async () => {
  const s = setup();
  await s.register();
  await s.send('Добавить авто');
  await s.send('Hyundai Starex 2017');
  await s.tap('Отмена');
  const old = draftOf(s);
  s.cars.update(old.id, { rentalModes: ['WITH_DRIVER'], priceWithDriver: 6000, draftStep: 'description' });
  await s.send('Добавить авто');
  await s.tap('Продолжить');
  assert.match(s.lastText(), /Цена аренды за сутки/);
  const car = draftOf(s);
  assert.deepStrictEqual(car.rentalModes, ['SELF_DRIVE']);
  assert.strictEqual(car.priceWithDriver, null);
});

test('summary edit: one field of a screen is edited on its own', async () => {
  const s = setup();
  await s.register();
  await fillFullCar(s);
  let car;
  // One field of a screen is edited on its own.
  await s.tap('Изменить');
  await s.tap('Кузов');
  await s.tap('Пикап');
  assert.match(s.lastText(), /Кузов: Пикап/);
  car = draftOf(s);
  assert.strictEqual(car.bodyType, 'PICKUP');
  assert.strictEqual(car.fuel, 'DIESEL');
});

test('copy an existing car: only the photos are asked', async () => {
  const s = setup();
  await s.register();
  const first = await fillFullCar(s);
  s.cars.update(first.id, { status: 'APPROVED' });       // pretend it was published

  await s.send('Добавить авто');
  await s.tap('Копия: Toyota Land Cruiser 200 2019');
  assert.match(s.texts().at(-2), /Скопировали данные .* Осталось добавить фото/);
  assert.match(s.lastText(), /^Фото/);                   // photos are never copied; one step, no counter
  await s.sendPhotos(4);
  await s.tap('Готово');
  assert.match(s.lastText(), /^Проверьте анкету/);
  const copy = s.cars.latestDraft(first.partnerId);
  assert.strictEqual(copy.copiedFromId, first.id);
  assert.strictEqual(copy.priceSelfDrive, 4500);
  assert.strictEqual(copy.restrictions, first.restrictions);
  assert.strictEqual(copy.plateNumber, null);
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
