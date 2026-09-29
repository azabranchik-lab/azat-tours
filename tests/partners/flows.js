// Shared flows for bot tests: a moderation-ready harness and a car submitted/published.
const { setup, makeImage, USER, GROUP } = require('./helpers');

const fakeTranslate = async fields => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, 'EN ' + v]));

function modSetup(extra = {}, deps = {}) {
  const changed = [];
  const s = setup(undefined, { adminChatId: GROUP, ...extra }, null, { translate: fakeTranslate, onCarsChanged: () => changed.push(1), ...deps });
  s.changed = changed;
  return s;
}

// Registered partner with a complete draft at the summary.
async function readyCar(s, plate = 'Замажьте номер за меня') {
  if (!s.store.getByTelegramId(USER) || !s.store.getByTelegramId(USER).offerAcceptedAt) await s.register();
  await s.send('Добавить авто');
  await s.tap('Toyota'); await s.send('Camry'); await s.send('2019');
  await s.tap('Седан'); await s.tap('Автомат'); await s.tap('Передний'); await s.tap('Бензин'); await s.tap('5');
  await s.send('белый'); await s.send('01KG 123 ABC'); await s.send('80000');
  await s.tap('Кондиционер'); await s.tap('Готово');
  await s.send('Чистая ухоженная машина, для города и трассы.');
  await s.tap('Без водителя'); await s.tap('Готово'); await s.send('3500');
  await s.tap('Пропустить'); await s.send('10000');
  await s.tap('ОСАГО (обязательная)'); await s.tap('Да, за доплату');
  await s.send('от 25 лет'); await s.tap('Пропустить');
  await s.tap('Круглый год');
  await s.tap(plate);
  await s.sendPhotos(8, { buf: await makeImage() });
  await s.tap('Готово');
  return s.cars.latestDraft(s.store.getByTelegramId(USER).id);
}

// Submit a ready car and publish it through the group.
async function publishedCar(s, plate) {
  const car = await readyCar(s, plate);
  await s.tap('Отправить на проверку');
  await s.groupTap('Одобрить');
  await s.groupTap('Опубликовать');
  return s.cars.get(car.id);
}

module.exports = { fakeTranslate, modSetup, readyCar, publishedCar };
