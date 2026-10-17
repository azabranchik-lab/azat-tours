// Shared flows for bot tests: a moderation-ready harness and a car submitted/published.
const { setup, makeImage, USER, GROUP } = require('./helpers');

function modSetup(extra = {}, deps = {}) {
  const changed = [];
  const s = setup(undefined, { adminChatId: GROUP, ...extra }, null, { onCarsChanged: () => changed.push(1), ...deps });
  s.changed = changed;
  return s;
}

// The «Характеристики» screen: one button per row, then «Готово».
async function specs(s, body = 'Седан', drive = 'Передний', seats = '5') {
  await s.tap(body); await s.tap('Автомат'); await s.tap(drive); await s.tap('Бензин'); await s.tap(seats);
  await s.tap('Готово');
}

// The «Страховка, доставка и срок» screen.
async function insDelivery(s, insurance = 'ОСАГО (обязательная)', delivery = 'Да, за доплату', days = '2 дня') {
  await s.tap(insurance); await s.tap(delivery); await s.tap(days); await s.tap('Готово');
}

// Registered partner with a complete draft at the summary (4 photos).
async function readyCar(s, nPhotos = 4) {
  if (!s.store.getByTelegramId(USER) || !s.store.getByTelegramId(USER).offerAcceptedAt) await s.register();
  await s.send('Добавить авто');
  await s.send('Toyota Camry 2019');
  await specs(s);
  await s.send('01KG 123 ABC');
  await s.tap('Кондиционер'); await s.tap('Готово');
  await s.send('Чистая ухоженная машина, для города и трассы.');
  await s.tap('Без водителя'); await s.send('3500');
  await s.send('10000');
  await insDelivery(s);
  await s.send('от 25 лет');
  await s.sendPhotos(nPhotos, { buf: await makeImage() });
  if (nPhotos < 6) await s.tap('Готово');         // 6 photos go straight to the summary
  return s.cars.latestDraft(s.store.getByTelegramId(USER).id);
}

// Submit a ready car and publish it through the group.
async function publishedCar(s, nPhotos) {
  const car = await readyCar(s, nPhotos);
  await s.tap('Отправить на проверку');
  await s.groupTap('Одобрить');
  return s.cars.get(car.id);
}

module.exports = { modSetup, readyCar, publishedCar, specs, insDelivery };
