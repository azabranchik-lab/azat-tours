// «Мои авто» (SPEC §6.7).
const test = require('node:test');
const assert = require('node:assert');
const { makeImage, USER } = require('./helpers');
const { modSetup, readyCar, publishedCar } = require('./flows');

const pid = s => s.store.getByTelegramId(USER).id;

test('list shows every car with its status; empty list says how to start', async () => {
  const s = modSetup();
  await s.register();
  await s.send('Мои авто');
  assert.match(s.lastText(), /пока нет авто/);

  await publishedCar(s);
  await s.send('Мои авто');
  assert.match(s.lastText(), /^Ваши авто: 1$/);
  assert.ok(s.hasButton('Toyota Camry 2019 · Опубликовано'));
});

test('published car: price change applies at once and rebuilds the site', async () => {
  const s = modSetup();
  const car = await publishedCar(s);
  const rebuilt = s.changed.length;

  await s.send('Мои авто');
  await s.tap('Toyota Camry 2019 · Опубликовано');
  assert.match(s.lastText(), /Статус: Опубликовано\nСейчас: Свободно/);
  assert.match(s.lastText(), /Без водителя: 3\s500 сом\/сутки/);

  await s.tap('Изменить цену');                          // only self-drive → asks straight away
  assert.match(s.lastText(), /Новая цена без водителя, сом за сутки\. Сейчас: 3\s500/);
  await s.send('abc');
  assert.match(s.lastText(), /Напишите число/);
  await s.send('4 200');
  assert.ok(s.texts().includes('Цена обновлена.'));
  const c = s.cars.get(car.id);
  assert.strictEqual(c.priceSelfDrive, 4200);
  assert.strictEqual(c.status, 'APPROVED', 'no re-moderation for a price');
  assert.strictEqual(s.changed.length, rebuilt + 1);
});

test('free/busy and pause/resume toggle at once', async () => {
  const s = modSetup();
  const car = await publishedCar(s);
  await s.send('Мои авто');
  await s.tap('Toyota Camry 2019 · Опубликовано');

  await s.tap('Свободно / Занято');
  assert.strictEqual(s.cars.get(car.id).availability, 'BUSY');
  assert.strictEqual(s.lastAnswer(), 'Отмечено: Занято.');
  await s.tap('Пауза');
  assert.strictEqual(s.cars.get(car.id).status, 'PAUSED');
  assert.ok(s.hasButton('Вернуть на сайт'));
  await s.tap('Вернуть на сайт');
  assert.strictEqual(s.cars.get(car.id).status, 'APPROVED');

  await s.send('Мои авто');
  assert.ok(s.hasButton('Toyota Camry 2019 · Опубликовано · Занято'));
});

test('edit a published car: warning, off the site at once, back to moderation "после изменений"', async () => {
  const s = modSetup();
  const car = await publishedCar(s);
  const rebuilt = s.changed.length;
  await s.send('Мои авто');
  await s.tap('Toyota Camry 2019 · Опубликовано');
  await s.tap('Редактировать');
  assert.match(s.lastText().replace(/\n/g, ' '), /снова пройдёт проверку/);
  // The warning replaces the car menu in place; the newest message with it is the menu.
  await s.tap('Продолжить');

  let c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'DRAFT');
  assert.strictEqual(c.en, null);
  assert.ok(c.approvedAt, 'remembers it was published');
  assert.strictEqual(s.changed.length, rebuilt + 1, 'site rebuilt so the car disappears');
  assert.match(s.lastText(), /^Проверьте анкету/);

  await s.tap('Изменить'); await s.tap('Модель');
  await s.send('Camry Hybrid');
  await s.tap('Отправить на проверку');
  c = s.cars.get(car.id);
  assert.strictEqual(c.status, 'PENDING');
  assert.match(s.groupTexts().filter(t => t.startsWith('На проверку')).at(-1), /^На проверку после изменений: Toyota Camry Hybrid 2019/);
});

test('delete: published car is archived (soft), never-sent draft is erased', async () => {
  const s = modSetup();
  const car = await publishedCar(s);
  await s.send('Мои авто');
  await s.tap('Toyota Camry 2019 · Опубликовано');
  await s.tap('Удалить');
  assert.match(s.lastText(), /Удалить Toyota Camry 2019\?/);
  await s.tap('Да, удалить');
  assert.strictEqual(s.cars.get(car.id).status, 'ARCHIVED');
  assert.match(s.lastText(), /пока нет авто/);

  await s.send('Добавить авто');                           // nothing left to copy from: straight to a new car
  await s.tap('Kia'); await s.send('Rio');
  const draft = s.cars.latestDraft(pid(s));
  await s.send('Мои авто');
  await s.tap('Kia Rio · Черновик');
  assert.ok(s.hasButton('Продолжить заполнение'));
  await s.tap('Удалить');
  await s.tap('Да, удалить');
  assert.strictEqual(s.cars.get(draft.id), null);
});

test('copy from «Мои авто» and continue a draft from the list', async () => {
  const s = modSetup();
  const car = await publishedCar(s);
  await s.send('Мои авто');
  await s.tap('Toyota Camry 2019 · Опубликовано');
  await s.tap('Сделать копию');
  assert.match(s.lastText(), /Шаг 1 из 4\nЦвет/);
  await s.tap('Пропустить');                               // colour is optional now
  assert.match(s.lastText(), /Госномер/);
  const copy = s.cars.latestDraft(car.partnerId);
  assert.strictEqual(copy.copiedFromId, car.id);

  await s.send('Мои авто');                                // leave the wizard…
  await s.tap('Toyota Camry 2019 · Черновик');
  await s.tap('Продолжить заполнение');                    // …and come back to the same step
  assert.match(s.lastText(), /Госномер/);
});

test('rejected car shows the reason and «Исправить»; someone else\'s car is not reachable', async () => {
  const s = modSetup();
  const car = await readyCar(s);
  await s.tap('Отправить на проверку');
  await s.groupTap('Отклонить');
  await s.groupReply('#reason', 'Размытые фото салона');
  await s.send('Мои авто');
  await s.tap('Toyota Camry 2019 · Отклонено');
  assert.match(s.lastText(), /Причина отклонения: Размытые фото салона/);
  assert.ok(s.hasButton('Исправить'));

  const other = s.cars.create(s.store.getOrCreate(4242, 'stranger').id, {});
  await s.press(`my:car:${other.id}`);
  assert.match(s.lastAnswer(), /неактуальна/);
  assert.ok(car);
});

test('colour is optional in the wizard', async () => {
  const s = modSetup();
  await s.register();
  await s.send('Добавить авто');
  await s.tap('Kia'); await s.send('Rio'); await s.send('2018');
  await s.tap('Седан'); await s.tap('Автомат'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  assert.match(s.lastText(), /Цвет автомобиля/);
  await s.tap('Пропустить');
  assert.match(s.lastText(), /Госномер/);
  assert.ok(makeImage);
});
